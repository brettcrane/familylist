"""User API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_user
from app.models import User
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


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Get a user by ID.

    Requires Clerk authentication.
    """
    user = user_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
