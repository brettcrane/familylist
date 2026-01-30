"""User service - business logic for user operations."""

import logging

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.clerk_auth import ClerkUser
from app.models import User, utc_now
from app.schemas import UserCreate, UserUpdate

logger = logging.getLogger(__name__)


def get_user_by_id(db: Session, user_id: str) -> User | None:
    """Get a user by internal ID."""
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_clerk_id(db: Session, clerk_user_id: str) -> User | None:
    """Get a user by Clerk user ID."""
    return db.query(User).filter(User.clerk_user_id == clerk_user_id).first()


def get_user_by_email(db: Session, email: str) -> User | None:
    """Get a user by email address."""
    return db.query(User).filter(User.email == email).first()


def create_user(db: Session, data: UserCreate) -> User:
    """Create a new user."""
    user = User(
        clerk_user_id=data.clerk_user_id,
        display_name=data.display_name,
        email=data.email,
        avatar_url=data.avatar_url,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user: User, data: UserUpdate) -> User:
    """Update a user."""
    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(user, field, value)

    user.updated_at = utc_now()
    db.commit()
    db.refresh(user)
    return user


def get_or_create_user(db: Session, clerk_user: ClerkUser) -> User:
    """Get or create a user from Clerk authentication data.

    This is the primary method for syncing Clerk user data to the local database.
    If the user exists, their profile is updated with the latest Clerk data.
    If not, a new user is created.

    Handles race conditions where two concurrent requests try to create the same
    user by catching IntegrityError and re-fetching.

    Args:
        db: Database session
        clerk_user: ClerkUser from JWT verification

    Returns:
        The local User object

    Raises:
        HTTPException: 503 if database is temporarily unavailable
        HTTPException: 500 if user creation fails unexpectedly
    """
    try:
        user = get_user_by_clerk_id(db, clerk_user.clerk_user_id)

        if user:
            # Update user with latest Clerk data
            updated = False

            if clerk_user.display_name and user.display_name != clerk_user.display_name:
                user.display_name = clerk_user.display_name
                updated = True

            if clerk_user.email and user.email != clerk_user.email:
                user.email = clerk_user.email
                updated = True

            if clerk_user.avatar_url and user.avatar_url != clerk_user.avatar_url:
                user.avatar_url = clerk_user.avatar_url
                updated = True

            if updated:
                user.updated_at = utc_now()
                db.commit()
                db.refresh(user)

            return user

        # Create new user
        new_user = User(
            clerk_user_id=clerk_user.clerk_user_id,
            display_name=clerk_user.display_name or clerk_user.email or "User",
            email=clerk_user.email,
            avatar_url=clerk_user.avatar_url,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user

    except IntegrityError as e:
        # Log the actual constraint error for debugging
        db.rollback()
        logger.warning(
            f"IntegrityError creating user for clerk_id={clerk_user.clerk_user_id}: {e}"
        )

        # Try to re-fetch in case it was a race condition
        user = get_user_by_clerk_id(db, clerk_user.clerk_user_id)
        if user:
            logger.info(f"Found user after IntegrityError (race condition resolved)")
            return user

        # Check if there are ANY users in the table (debugging)
        from sqlalchemy import text
        count_result = db.execute(text("SELECT COUNT(*) FROM users")).scalar()
        logger.error(
            f"Failed to find user after IntegrityError. "
            f"clerk_id={clerk_user.clerk_user_id}, total_users={count_result}, "
            f"error_details={str(e.orig) if hasattr(e, 'orig') else str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to create or find user. Please try again.",
        )

    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error in get_or_create_user: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=503,
            detail="Database temporarily unavailable. Please try again.",
        )
