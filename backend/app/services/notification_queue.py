"""Notification queue with batching for push notifications.

Batches rapid events to avoid notification spam during active list usage
(e.g., checking off many items while grocery shopping).

Strategy:
1. First event for a user+list starts a 30-second timer
2. Each subsequent event extends the timer by 10 seconds (max 2 min total)
3. After timer expires OR 15+ events accumulated: flush and send
4. Never notify users about their own actions
5. Group events by actor: "Sarah added 4 items and checked 2"
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.database import get_db_context
from app.services import push_service

logger = logging.getLogger(__name__)

# Batching configuration
INITIAL_DELAY = 30.0  # seconds before first flush
EXTEND_DELAY = 10.0  # seconds to extend per additional event
MAX_DELAY = 120.0  # maximum total delay (2 minutes)
MAX_EVENTS = 15  # force flush after this many events


@dataclass
class PendingEvent:
    """A single pending notification event."""

    event_type: str  # item_checked, item_created, etc.
    item_name: str | None
    actor_user_id: str
    actor_name: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class BatchState:
    """State for a notification batch."""

    list_id: str
    list_name: str
    events: list[PendingEvent] = field(default_factory=list)
    timer_task: asyncio.Task | None = None
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class NotificationQueue:
    """In-memory notification queue with batching.

    Batches events per user+list combination, then sends a single
    notification summarizing all activity.
    """

    def __init__(self):
        # Map of batch_key (user_id:list_id) -> BatchState
        self._batches: dict[str, BatchState] = {}
        self._lock = asyncio.Lock()

    def _batch_key(self, user_id: str, list_id: str) -> str:
        """Generate a unique key for a user+list batch."""
        return f"{user_id}:{list_id}"

    async def queue_event(
        self,
        list_id: str,
        list_name: str,
        event_type: str,
        item_name: str | None,
        actor_user_id: str,
        actor_name: str,
        recipient_user_ids: list[str],
    ) -> None:
        """Queue a notification event for multiple recipients.

        Args:
            list_id: The list that was modified
            list_name: Name of the list (for notification message)
            event_type: Type of event (item_checked, item_created, etc.)
            item_name: Name of the item (if applicable)
            actor_user_id: User who performed the action
            actor_name: Display name of the actor
            recipient_user_ids: Users to notify (actor will be filtered out)
        """
        event = PendingEvent(
            event_type=event_type,
            item_name=item_name,
            actor_user_id=actor_user_id,
            actor_name=actor_name,
        )

        async with self._lock:
            for user_id in recipient_user_ids:
                # CRITICAL: Never notify the actor about their own action
                if user_id == actor_user_id:
                    continue

                await self._add_to_batch(user_id, list_id, list_name, event)

    async def _add_to_batch(
        self,
        user_id: str,
        list_id: str,
        list_name: str,
        event: PendingEvent,
    ) -> None:
        """Add an event to a user's batch (must hold lock)."""
        key = self._batch_key(user_id, list_id)

        if key not in self._batches:
            # Create new batch
            self._batches[key] = BatchState(
                list_id=list_id,
                list_name=list_name,
                events=[event],
            )
            # Start timer for initial delay
            self._batches[key].timer_task = asyncio.create_task(
                self._flush_after_delay(user_id, list_id, INITIAL_DELAY)
            )
            logger.debug(f"Started new batch for {key}, initial delay {INITIAL_DELAY}s")
        else:
            batch = self._batches[key]
            batch.events.append(event)

            # Check if we should force flush
            if len(batch.events) >= MAX_EVENTS:
                logger.debug(f"Batch {key} hit max events ({MAX_EVENTS}), forcing flush")
                if batch.timer_task:
                    batch.timer_task.cancel()
                asyncio.create_task(self._flush_batch(user_id, list_id))
            else:
                # Extend the timer (up to max delay)
                elapsed = (datetime.now(timezone.utc) - batch.started_at).total_seconds()
                remaining_budget = MAX_DELAY - elapsed

                if remaining_budget > 0:
                    extension = min(EXTEND_DELAY, remaining_budget)
                    # Cancel old timer and start new one
                    if batch.timer_task:
                        batch.timer_task.cancel()
                    batch.timer_task = asyncio.create_task(
                        self._flush_after_delay(user_id, list_id, extension)
                    )
                    logger.debug(f"Extended batch {key} timer by {extension}s")

    async def _flush_after_delay(
        self, user_id: str, list_id: str, delay: float
    ) -> None:
        """Wait for delay then flush the batch."""
        try:
            await asyncio.sleep(delay)
            await self._flush_batch(user_id, list_id)
        except asyncio.CancelledError:
            # Timer was cancelled (extended or force flushed)
            pass

    async def _flush_batch(self, user_id: str, list_id: str) -> None:
        """Flush a batch and send the notification."""
        key = self._batch_key(user_id, list_id)

        async with self._lock:
            batch = self._batches.pop(key, None)

        if not batch or not batch.events:
            return

        logger.info(
            f"Flushing batch for user {user_id}, list {list_id}: "
            f"{len(batch.events)} events"
        )

        # Format the notification message
        title, body = self._format_notification(batch)

        # Check user preferences and send
        try:
            with get_db_context() as db:
                prefs = push_service.get_notification_preferences(db, user_id)

                # Check if notifications are disabled
                if prefs and prefs.list_updates == "off":
                    logger.debug(f"User {user_id} has list updates disabled, skipping")
                    return

                # Check quiet hours
                if push_service.is_quiet_hours(prefs):
                    logger.debug(f"User {user_id} is in quiet hours, skipping")
                    return

                # Send the notification
                push_service.send_push_notification(
                    db=db,
                    user_id=user_id,
                    title=title,
                    body=body,
                    data={"list_id": list_id},
                    tag=f"list-{list_id}",
                )
        except Exception as e:
            logger.error(
                f"Failed to send push notification batch to user {user_id} "
                f"for list {batch.list_id}: {type(e).__name__}: {e}",
                exc_info=True,
            )

    def _format_notification(self, batch: BatchState) -> tuple[str, str]:
        """Format a batch of events into a notification title and body.

        Returns (title, body) tuple.
        """
        list_name = batch.list_name
        events = batch.events

        # Group events by actor and action type
        by_actor: dict[str, dict[str, list[str]]] = {}

        for event in events:
            actor = event.actor_name
            if actor not in by_actor:
                by_actor[actor] = {
                    "added": [],
                    "checked": [],
                    "unchecked": [],
                    "deleted": [],
                    "updated": [],
                }

            item = event.item_name or "item"
            if event.event_type == "item_created":
                by_actor[actor]["added"].append(item)
            elif event.event_type == "item_checked":
                by_actor[actor]["checked"].append(item)
            elif event.event_type == "item_unchecked":
                by_actor[actor]["unchecked"].append(item)
            elif event.event_type == "item_deleted":
                by_actor[actor]["deleted"].append(item)
            elif event.event_type in ("item_updated", "items_cleared", "items_restored"):
                by_actor[actor]["updated"].append(item)

        # Build message parts
        parts = []
        for actor, actions in by_actor.items():
            action_parts = []

            if actions["added"]:
                count = len(actions["added"])
                if count == 1:
                    action_parts.append(f"added {actions['added'][0]}")
                elif count <= 3:
                    action_parts.append(f"added {', '.join(actions['added'])}")
                else:
                    action_parts.append(f"added {count} items")

            if actions["checked"]:
                count = len(actions["checked"])
                if count == 1:
                    action_parts.append(f"checked off {actions['checked'][0]}")
                else:
                    action_parts.append(f"checked off {count} items")

            if actions["unchecked"]:
                count = len(actions["unchecked"])
                action_parts.append(f"unchecked {count} item{'s' if count > 1 else ''}")

            if actions["deleted"]:
                count = len(actions["deleted"])
                action_parts.append(f"removed {count} item{'s' if count > 1 else ''}")

            if action_parts:
                parts.append(f"{actor} {' and '.join(action_parts)}")

        title = list_name
        body = "; ".join(parts) if parts else "List updated"

        return title, body


# Global singleton instance
notification_queue = NotificationQueue()
