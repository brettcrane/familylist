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

# Queue size limit per subscriber - prevents unbounded memory growth
SUBSCRIBER_QUEUE_SIZE = 100

# Timeout for queue.get() - allows periodic disconnect checks
QUEUE_GET_TIMEOUT = 30.0


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
        self._subscribers: dict[str, set[asyncio.Queue[ListEvent | None]]] = {}
        # Per-list locks to reduce contention
        self._locks: dict[str, asyncio.Lock] = {}
        # Global lock for managing the locks dict
        self._global_lock = asyncio.Lock()

    async def _get_list_lock(self, list_id: str) -> asyncio.Lock:
        """Get or create a lock for a specific list."""
        async with self._global_lock:
            if list_id not in self._locks:
                self._locks[list_id] = asyncio.Lock()
            return self._locks[list_id]

    async def subscribe(self, list_id: str) -> AsyncGenerator[ListEvent, None]:
        """Subscribe to events for a specific list.

        Yields ListEvent objects as they are published.
        Automatically cleans up on generator exit.
        Uses timeout on queue.get() to allow periodic disconnect checks.

        Usage:
            async for event in broadcaster.subscribe(list_id):
                yield f"data: {event.to_sse_data()}\n\n"
        """
        # Use bounded queue to prevent memory issues with slow clients
        queue: asyncio.Queue[ListEvent | None] = asyncio.Queue(maxsize=SUBSCRIBER_QUEUE_SIZE)
        lock = await self._get_list_lock(list_id)

        async with lock:
            if list_id not in self._subscribers:
                self._subscribers[list_id] = set()
            self._subscribers[list_id].add(queue)
            logger.info(
                f"SSE subscriber added for list {list_id}. "
                f"Total subscribers: {len(self._subscribers[list_id])}"
            )

        try:
            while True:
                try:
                    # Use timeout to allow periodic disconnect checks by caller
                    event = await asyncio.wait_for(queue.get(), timeout=QUEUE_GET_TIMEOUT)
                    # None is a sentinel value to signal shutdown
                    if event is None:
                        break
                    yield event
                except asyncio.TimeoutError:
                    # Timeout allows caller to check is_disconnected()
                    # Yield nothing, just continue the loop
                    continue
        finally:
            # Cleanup on disconnect
            async with lock:
                if list_id in self._subscribers:
                    self._subscribers[list_id].discard(queue)
                    subscriber_count = len(self._subscribers[list_id])
                    if not self._subscribers[list_id]:
                        del self._subscribers[list_id]
                        # Clean up the lock too if no more subscribers
                        async with self._global_lock:
                            if list_id in self._locks and list_id not in self._subscribers:
                                del self._locks[list_id]
                    logger.info(
                        f"SSE subscriber removed for list {list_id}. "
                        f"Remaining: {subscriber_count}"
                    )

    async def publish(self, event: ListEvent) -> None:
        """Publish an event to all subscribers of the list.

        Non-blocking: if a subscriber's queue is full, the event is dropped
        for that subscriber (they can resync via HTTP).
        """
        list_id = event.list_id
        lock = await self._get_list_lock(list_id)

        async with lock:
            subscribers = self._subscribers.get(list_id, set()).copy()

        if not subscribers:
            logger.debug(f"No subscribers for list {list_id}, skipping event publish")
            return

        logger.info(
            f"Publishing {event.event_type} event for list {list_id} "
            f"to {len(subscribers)} subscribers"
        )

        dropped_count = 0
        for queue in subscribers:
            try:
                # Non-blocking put with immediate fail if full
                queue.put_nowait(event)
            except asyncio.QueueFull:
                dropped_count += 1

        if dropped_count > 0:
            logger.warning(
                f"Dropped {event.event_type} event for {dropped_count} slow subscriber(s) "
                f"on list {list_id}. They should resync via HTTP."
            )

    def get_subscriber_count(self, list_id: str) -> int:
        """Get the number of active subscribers for a list."""
        return len(self._subscribers.get(list_id, set()))


# Global singleton instance
event_broadcaster = EventBroadcaster()
