"""List sharing API endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.database import get_db
from app.dependencies import require_user
from app.models import User
from app.schemas import (
    ListShareByEmailRequest,
    ListShareUpdate,
    ListShareWithUserResponse,
)
from app.services import list_service, user_service

router = APIRouter(prefix="/lists/{list_id}/shares", tags=["shares"])


@router.get("", response_model=list[ListShareWithUserResponse])
async def get_list_shares(
    list_id: str,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Get all shares for a list.

    Only the owner can see all shares.
    """
    # Check list exists
    lst = list_service.get_list_by_id(db, list_id)
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")

    # Only owner can view shares
    if lst.owner_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Only the owner can view shares"
        )

    shares = list_service.get_list_shares(db, list_id)

    # Build response with user details
    result = []
    for share in shares:
        user = user_service.get_user_by_id(db, share.user_id)
        if user:
            result.append(
                ListShareWithUserResponse(
                    id=share.id,
                    list_id=share.list_id,
                    user={
                        "id": user.id,
                        "clerk_user_id": user.clerk_user_id,
                        "display_name": user.display_name,
                        "email": user.email,
                        "avatar_url": user.avatar_url,
                        "created_at": user.created_at,
                        "updated_at": user.updated_at,
                    },
                    permission=share.permission,
                    created_at=share.created_at,
                )
            )
        else:
            logger.error(
                "Orphaned share found: share_id=%s references non-existent user_id=%s (data integrity issue)",
                share.id,
                share.user_id,
            )

    return result


@router.post("", response_model=ListShareWithUserResponse, status_code=201)
async def share_list_by_email(
    list_id: str,
    data: ListShareByEmailRequest,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Share a list with a user by email.

    Only the owner can share a list.
    """
    # Check list exists
    lst = list_service.get_list_by_id(db, list_id)
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")

    # Only owner can share
    if lst.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can share this list")

    # Look up user by email
    target_user = user_service.get_user_by_email(db, data.email)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found with that email")

    # Can't share with yourself
    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot share a list with yourself")

    # Check if already shared
    existing_share = list_service.get_existing_share(db, list_id, target_user.id)
    if existing_share:
        raise HTTPException(
            status_code=400, detail="List is already shared with this user"
        )

    # Create the share
    share = list_service.create_list_share(
        db, list_id, target_user.id, data.permission.value
    )

    return ListShareWithUserResponse(
        id=share.id,
        list_id=share.list_id,
        user={
            "id": target_user.id,
            "clerk_user_id": target_user.clerk_user_id,
            "display_name": target_user.display_name,
            "email": target_user.email,
            "avatar_url": target_user.avatar_url,
            "created_at": target_user.created_at,
            "updated_at": target_user.updated_at,
        },
        permission=share.permission,
        created_at=share.created_at,
    )


@router.patch("/{share_id}", response_model=ListShareWithUserResponse)
async def update_share_permission(
    list_id: str,
    share_id: str,
    data: ListShareUpdate,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Update a share's permission level.

    Only the owner can modify share permissions.
    """
    # Check list exists
    lst = list_service.get_list_by_id(db, list_id)
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")

    # Only owner can modify shares
    if lst.owner_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Only the owner can modify share permissions"
        )

    # Get the share
    share = list_service.get_share_by_id(db, share_id)
    if not share or share.list_id != list_id:
        raise HTTPException(status_code=404, detail="Share not found")

    # Update the share
    updated_share = list_service.update_list_share(db, share, data.permission.value)

    # Get user details
    user = user_service.get_user_by_id(db, updated_share.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return ListShareWithUserResponse(
        id=updated_share.id,
        list_id=updated_share.list_id,
        user={
            "id": user.id,
            "clerk_user_id": user.clerk_user_id,
            "display_name": user.display_name,
            "email": user.email,
            "avatar_url": user.avatar_url,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        },
        permission=updated_share.permission,
        created_at=updated_share.created_at,
    )


@router.delete("/{share_id}", status_code=204)
async def revoke_share(
    list_id: str,
    share_id: str,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Revoke a share (remove user's access to the list).

    Only the owner can revoke shares.
    """
    # Check list exists
    lst = list_service.get_list_by_id(db, list_id)
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")

    # Only owner can revoke shares
    if lst.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can revoke shares")

    # Get the share
    share = list_service.get_share_by_id(db, share_id)
    if not share or share.list_id != list_id:
        raise HTTPException(status_code=404, detail="Share not found")

    # Delete the share
    list_service.delete_list_share(db, share)

    return None
