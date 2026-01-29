"""FastAPI dependencies for authentication and user context."""

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import AuthResult, get_auth
from app.database import get_db
from app.models import User
from app.services import user_service


async def get_current_user(
    auth: AuthResult = Depends(get_auth),
    db: Session = Depends(get_db),
) -> User | None:
    """Get the current user if authenticated with Clerk.

    Returns None if using API key authentication (for backward compatibility).
    Returns the User object if authenticated with Clerk JWT.
    """
    if auth.clerk_user:
        # Sync user data from Clerk and return local user
        return user_service.get_or_create_user(db, auth.clerk_user)

    # API key authentication - no user context
    return None


async def require_user(
    auth: AuthResult = Depends(get_auth),
    db: Session = Depends(get_db),
) -> User:
    """Require a Clerk-authenticated user.

    Raises 401 if using API key authentication or not authenticated.
    Use this for endpoints that require user context.
    """
    if not auth.clerk_user:
        raise HTTPException(
            status_code=401,
            detail="User authentication required. Please sign in with Clerk.",
        )

    return user_service.get_or_create_user(db, auth.clerk_user)


async def get_optional_user(
    auth: AuthResult = Depends(get_auth),
    db: Session = Depends(get_db),
) -> User | None:
    """Get user if available, but don't require it.

    Returns User if Clerk authenticated, None if API key authenticated.
    Unlike get_current_user, this doesn't raise if not authenticated.
    """
    if auth.clerk_user:
        return user_service.get_or_create_user(db, auth.clerk_user)
    return None
