"""Push notification service for sending Web Push notifications."""

import json
import logging
from datetime import datetime, timezone

from pywebpush import WebPushException, webpush
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import NotificationPreferences, PushSubscription, utc_now

logger = logging.getLogger(__name__)


def get_user_subscriptions(db: Session, user_id: str) -> list[PushSubscription]:
    """Get all push subscriptions for a user."""
    return (
        db.query(PushSubscription)
        .filter(PushSubscription.user_id == user_id)
        .all()
    )


def get_subscription_by_endpoint(
    db: Session, user_id: str, endpoint: str
) -> PushSubscription | None:
    """Get a specific push subscription by endpoint."""
    return (
        db.query(PushSubscription)
        .filter(
            PushSubscription.user_id == user_id,
            PushSubscription.endpoint == endpoint,
        )
        .first()
    )


def create_subscription(
    db: Session,
    user_id: str,
    endpoint: str,
    p256dh_key: str,
    auth_key: str,
    user_agent: str | None = None,
) -> PushSubscription:
    """Create a new push subscription."""
    # Check if subscription already exists
    existing = get_subscription_by_endpoint(db, user_id, endpoint)
    if existing:
        # Update existing subscription (keys may have changed)
        existing.p256dh_key = p256dh_key
        existing.auth_key = auth_key
        existing.user_agent = user_agent
        db.commit()
        db.refresh(existing)
        return existing

    subscription = PushSubscription(
        user_id=user_id,
        endpoint=endpoint,
        p256dh_key=p256dh_key,
        auth_key=auth_key,
        user_agent=user_agent,
    )
    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    return subscription


def delete_subscription(db: Session, user_id: str, endpoint: str) -> bool:
    """Delete a push subscription. Returns True if deleted."""
    subscription = get_subscription_by_endpoint(db, user_id, endpoint)
    if subscription:
        db.delete(subscription)
        db.commit()
        return True
    return False


def get_notification_preferences(
    db: Session, user_id: str
) -> NotificationPreferences | None:
    """Get notification preferences for a user."""
    return (
        db.query(NotificationPreferences)
        .filter(NotificationPreferences.user_id == user_id)
        .first()
    )


def get_or_create_notification_preferences(
    db: Session, user_id: str
) -> NotificationPreferences:
    """Get or create notification preferences for a user."""
    prefs = get_notification_preferences(db, user_id)
    if not prefs:
        prefs = NotificationPreferences(user_id=user_id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return prefs


def update_notification_preferences(
    db: Session,
    user_id: str,
    list_updates: str | None = None,
    list_sharing: str | None = None,
    quiet_start: str | None = None,
    quiet_end: str | None = None,
) -> NotificationPreferences:
    """Update notification preferences for a user."""
    prefs = get_or_create_notification_preferences(db, user_id)

    if list_updates is not None:
        prefs.list_updates = list_updates
    if list_sharing is not None:
        prefs.list_sharing = list_sharing
    if quiet_start is not None:
        prefs.quiet_start = quiet_start
    if quiet_end is not None:
        prefs.quiet_end = quiet_end

    db.commit()
    db.refresh(prefs)
    return prefs


def is_quiet_hours(prefs: NotificationPreferences | None) -> bool:
    """Check if current time is within quiet hours."""
    if not prefs or not prefs.quiet_start or not prefs.quiet_end:
        return False

    now = datetime.now(timezone.utc)
    current_time = now.strftime("%H:%M")

    start = prefs.quiet_start
    end = prefs.quiet_end

    # Handle overnight quiet hours (e.g., 22:00 to 07:00)
    if start <= end:
        # Same day range (e.g., 09:00 to 17:00)
        return start <= current_time <= end
    else:
        # Overnight range (e.g., 22:00 to 07:00)
        return current_time >= start or current_time <= end


def send_push_notification(
    db: Session,
    user_id: str,
    title: str,
    body: str,
    data: dict | None = None,
    tag: str | None = None,
) -> int:
    """Send a push notification to all of a user's devices.

    Returns the number of successful sends.
    """
    settings = get_settings()

    if not settings.push_enabled:
        logger.debug("Push notifications not configured, skipping")
        return 0

    subscriptions = get_user_subscriptions(db, user_id)
    if not subscriptions:
        logger.debug(f"No push subscriptions for user {user_id}")
        return 0

    payload = json.dumps({
        "title": title,
        "body": body,
        "icon": "/icons/icon-192.png",
        "badge": "/icons/badge-72.png",
        "tag": tag or "familylist",
        "renotify": True,
        "data": data or {},
    })

    success_count = 0
    expired_subscriptions = []

    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {
                        "p256dh": sub.p256dh_key,
                        "auth": sub.auth_key,
                    },
                },
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={
                    "sub": settings.vapid_mailto,
                },
            )

            # Update last_used_at
            sub.last_used_at = utc_now()
            success_count += 1

            logger.debug(f"Push sent to user {user_id}, endpoint {sub.endpoint[:50]}...")

        except WebPushException as e:
            if e.response is not None and e.response.status_code in (404, 410):
                # Subscription expired or invalid - mark for deletion
                logger.info(
                    f"Push subscription expired for user {user_id}: {e.response.status_code}"
                )
                expired_subscriptions.append(sub)
            else:
                logger.error(
                    f"Push failed for user {user_id}: {e}",
                    exc_info=True,
                )
        except Exception as e:
            logger.error(
                f"Unexpected push error for user {user_id}: {e}",
                exc_info=True,
            )

    # Clean up expired subscriptions
    for sub in expired_subscriptions:
        db.delete(sub)

    db.commit()

    if success_count > 0:
        logger.info(f"Sent push to {success_count} device(s) for user {user_id}")

    return success_count
