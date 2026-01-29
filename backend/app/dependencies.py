"""FastAPI dependencies for authentication and user context.

Provides dependency functions for injecting user context into endpoints:

- get_current_user: Returns User for Clerk auth, None for API key auth.
  Use this for endpoints that work with or without user context.

- require_user: Requires Clerk authentication, raises 401 otherwise.
  Use this for endpoints that need user context (e.g., /users/me).

Usage:
    @router.get("/items")
    def get_items(user: User | None = Depends(get_current_user)):
        if user:
            # Filter by user
        else:
            # Return all (API key mode)

    @router.get("/profile")
    def get_profile(user: User = Depends(require_user)):
        # user is guaranteed to be non-None
"""

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

    Returns:
        User object if authenticated with Clerk JWT.
        None if using API key authentication (for backward compatibility).

    Note:
        This dependency does NOT raise if not authenticated with Clerk.
        Use require_user() if you need to enforce Clerk authentication.
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

    Returns:
        User object from Clerk authentication.

    Raises:
        HTTPException: 401 if using API key authentication or not authenticated.

    Use this for endpoints that require user context, such as:
    - User profile endpoints
    - User-specific settings
    - Endpoints that must know who is making the request
    """
    if not auth.clerk_user:
        raise HTTPException(
            status_code=401,
            detail="User authentication required. Please sign in with Clerk.",
        )

    return user_service.get_or_create_user(db, auth.clerk_user)
