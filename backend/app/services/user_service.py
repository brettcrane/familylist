"""User service - business logic for user operations."""

from sqlalchemy.orm import Session

from app.clerk_auth import ClerkUser
from app.models import User, utc_now
from app.schemas import UserCreate, UserUpdate


def get_user_by_id(db: Session, user_id: str) -> User | None:
    """Get a user by internal ID."""
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_clerk_id(db: Session, clerk_user_id: str) -> User | None:
    """Get a user by Clerk user ID."""
    return db.query(User).filter(User.clerk_user_id == clerk_user_id).first()


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

    Args:
        db: Database session
        clerk_user: ClerkUser from JWT verification

    Returns:
        The local User object
    """
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

        if clerk_user.image_url and user.avatar_url != clerk_user.image_url:
            user.avatar_url = clerk_user.image_url
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
        avatar_url=clerk_user.image_url,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user
