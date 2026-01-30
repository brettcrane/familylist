"""User API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_user
from app.models import ListShare, User
from app.schemas import UserResponse
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(require_user),
):
    """Get the current authenticated user's info.

    Requires Clerk authentication - API key auth will return 401.
    """
    return current_user


@router.get("/lookup", response_model=UserResponse)
async def lookup_user_by_email(
    email: str,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Look up a user by email address.

    Requires Clerk authentication. Returns the user if found, otherwise 404.
    Used for sharing lists with other users.
    """
    user = user_service.get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Get a user by ID.

    Requires Clerk authentication. For privacy, users can only fetch:
    - Their own user info (same as /me)
    - Users who share a list with them

    Returns 404 for users that don't exist or the current user doesn't have
    permission to view (to avoid user enumeration).
    """
    # Allow fetching own user info
    if user_id == current_user.id:
        return current_user

    # Check if target user exists
    user = user_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if users share any lists (either direction)
    # User can see another user if:
    # 1. They share a list owned by current_user
    # 2. They share a list owned by target user
    # 3. They both have access to the same shared list

    # Check if target user has a share on any of current user's lists
    share_on_my_lists = (
        db.query(ListShare)
        .join(ListShare.list)
        .filter(
            ListShare.user_id == user_id,
            ListShare.list.has(owner_id=current_user.id),
        )
        .first()
    )

    if share_on_my_lists:
        return user

    # Check if current user has a share on any of target user's lists
    share_on_their_lists = (
        db.query(ListShare)
        .join(ListShare.list)
        .filter(
            ListShare.user_id == current_user.id,
            ListShare.list.has(owner_id=user_id),
        )
        .first()
    )

    if share_on_their_lists:
        return user

    # No relationship found - return 404 to avoid user enumeration
    raise HTTPException(status_code=404, detail="User not found")
