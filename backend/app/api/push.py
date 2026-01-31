"""Push notification API endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.auth import get_auth
from app.config import get_settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import (
    NotificationPreferencesResponse,
    NotificationPreferencesUpdate,
    PushSubscriptionCreate,
    PushSubscriptionDelete,
    PushSubscriptionResponse,
    VapidPublicKeyResponse,
)
from app.services import push_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/push", tags=["push"])


@router.get("/vapid-public-key", response_model=VapidPublicKeyResponse)
def get_vapid_public_key():
    """Get the VAPID public key for Web Push subscription.

    This endpoint does not require authentication so the frontend
    can check push support before the user is logged in.
    """
    settings = get_settings()

    if not settings.push_enabled:
        return VapidPublicKeyResponse(
            public_key="",
            enabled=False,
        )

    return VapidPublicKeyResponse(
        public_key=settings.vapid_public_key,
        enabled=True,
    )


@router.post(
    "/subscribe",
    response_model=PushSubscriptionResponse,
    dependencies=[Depends(get_auth)],
)
def subscribe_push(
    data: PushSubscriptionCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Register a push subscription for the current user's device."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    settings = get_settings()
    if not settings.push_enabled:
        raise HTTPException(
            status_code=503,
            detail="Push notifications are not configured on this server",
        )

    # Get user agent for device identification
    user_agent = request.headers.get("User-Agent")

    subscription = push_service.create_subscription(
        db=db,
        user_id=current_user.id,
        endpoint=data.endpoint,
        p256dh_key=data.keys.p256dh,
        auth_key=data.keys.auth,
        user_agent=user_agent,
    )

    logger.info(f"Push subscription registered for user {current_user.id}")

    return subscription


@router.delete("/unsubscribe", dependencies=[Depends(get_auth)])
def unsubscribe_push(
    data: PushSubscriptionDelete,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a push subscription."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    deleted = push_service.delete_subscription(
        db=db,
        user_id=current_user.id,
        endpoint=data.endpoint,
    )

    if not deleted:
        raise HTTPException(status_code=404, detail="Subscription not found")

    logger.info(f"Push subscription removed for user {current_user.id}")

    return {"status": "unsubscribed"}


@router.get(
    "/subscriptions",
    response_model=list[PushSubscriptionResponse],
    dependencies=[Depends(get_auth)],
)
def list_subscriptions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all push subscriptions for the current user."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    subscriptions = push_service.get_user_subscriptions(db, current_user.id)
    return subscriptions


@router.get(
    "/preferences",
    response_model=NotificationPreferencesResponse,
    dependencies=[Depends(get_auth)],
)
def get_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get notification preferences for the current user."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    prefs = push_service.get_or_create_notification_preferences(db, current_user.id)
    return prefs


@router.put(
    "/preferences",
    response_model=NotificationPreferencesResponse,
    dependencies=[Depends(get_auth)],
)
def update_preferences(
    data: NotificationPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update notification preferences for the current user."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    prefs = push_service.update_notification_preferences(
        db=db,
        user_id=current_user.id,
        list_updates=data.list_updates,
        list_sharing=data.list_sharing,
        quiet_start=data.quiet_start,
        quiet_end=data.quiet_end,
    )

    logger.info(f"Notification preferences updated for user {current_user.id}")

    return prefs
