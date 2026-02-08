"""User API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_auth
from app.database import get_db
from app.dependencies import require_user
from app.models import ListShare, User
from app.schemas import UserResponse
from app.services import user_service  # Still needed for get_user_by_id

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(require_user),
):
    """Get the current authenticated user's info.

    Requires Clerk authentication - API key auth will return 401.
    """
    return current_user


@router.get("/lookup", dependencies=[Depends(get_auth)])
async def lookup_users(
    name: str = Query(..., min_length=1, description="Partial name match"),
    db: Session = Depends(get_db),
):
    """Look up users by display name (partial match).

    Used for identity resolution (e.g., Cowork MCP resolving "Brett" to a user ID).
    Requires API key or Clerk authentication.
    """
    users = (
        db.query(User)
        .filter(func.lower(User.display_name).contains(name.lower()))
        .limit(20)
        .all()
    )
    return [
        {"id": u.id, "display_name": u.display_name}
        for u in users
    ]


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
