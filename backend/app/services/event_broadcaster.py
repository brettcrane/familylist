"""Event broadcasting service for real-time updates via SSE.

Provides in-memory pub/sub for list events, enabling real-time sync
across multiple clients viewing the same list.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import AsyncGenerator

logger = logging.getLogger(__name__)


@dataclass
class ListEvent:
    """Event representing a change to a list or its items."""

    event_type: str  # item_checked, item_unchecked, item_created, item_deleted, items_cleared
    list_id: str
    item_id: str | None = None
    item_name: str | None = None
    user_id: str | None = None
    user_name: str | None = None
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_sse_data(self) -> str:
        """Format event as SSE data string."""
        import json

        return json.dumps(
            {
                "event_type": self.event_type,
                "list_id": self.list_id,
                "item_id": self.item_id,
                "item_name": self.item_name,
                "user_id": self.user_id,
                "user_name": self.user_name,
                "timestamp": self.timestamp,
            }
        )


class EventBroadcaster:
    """In-memory pub/sub broadcaster for list events.

    Manages subscribers per list_id using asyncio.Queue.
    Handles cleanup on disconnect automatically.
    """

    def __init__(self):
        # Map of list_id -> set of subscriber queues
        self._subscribers: dict[str, set[asyncio.Queue[ListEvent]]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, list_id: str) -> AsyncGenerator[ListEvent, None]:
        """Subscribe to events for a specific list.

        Yields ListEvent objects as they are published.
        Automatically cleans up on generator exit.

        Usage:
            async for event in broadcaster.subscribe(list_id):
                yield f"data: {event.to_sse_data()}\n\n"
        """
        queue: asyncio.Queue[ListEvent] = asyncio.Queue()

        async with self._lock:
            if list_id not in self._subscribers:
                self._subscribers[list_id] = set()
            self._subscribers[list_id].add(queue)
            logger.info(
                f"SSE subscriber added for list {list_id}. "
                f"Total subscribers: {len(self._subscribers[list_id])}"
            )

        try:
            while True:
                event = await queue.get()
                yield event
        finally:
            # Cleanup on disconnect
            async with self._lock:
                if list_id in self._subscribers:
                    self._subscribers[list_id].discard(queue)
                    if not self._subscribers[list_id]:
                        del self._subscribers[list_id]
                    logger.info(
                        f"SSE subscriber removed for list {list_id}. "
                        f"Remaining: {len(self._subscribers.get(list_id, set()))}"
                    )

    async def publish(self, event: ListEvent) -> None:
        """Publish an event to all subscribers of the list.

        Non-blocking: if a subscriber's queue is full, the event is dropped
        for that subscriber (they can resync via HTTP).
        """
        list_id = event.list_id

        async with self._lock:
            subscribers = self._subscribers.get(list_id, set()).copy()

        if not subscribers:
            return

        logger.info(
            f"Publishing {event.event_type} event for list {list_id} "
            f"to {len(subscribers)} subscribers"
        )

        for queue in subscribers:
            try:
                # Non-blocking put with immediate fail if full
                queue.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning(
                    f"Event queue full for a subscriber on list {list_id}. "
                    "Event dropped."
                )

    def get_subscriber_count(self, list_id: str) -> int:
        """Get the number of active subscribers for a list."""
        return len(self._subscribers.get(list_id, set()))


# Global singleton instance
event_broadcaster = EventBroadcaster()
