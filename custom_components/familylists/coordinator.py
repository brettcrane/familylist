"""Data update coordinator for FamilyLists."""

from __future__ import annotations

from datetime import timedelta
import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import FamilyListsApiError, FamilyListsClient

_LOGGER = logging.getLogger(__name__)


def _process_items(items: list[dict[str, Any]]) -> dict[str, Any]:
    """Process items in a single pass to extract counts and last checked info.

    Returns a dict with:
    - checked_items: count of checked items
    - unchecked_items: count of unchecked items
    - total_items: total count
    - last_checked_item: name of the most recently checked item
    - last_checked_by: user ID who checked it
    - last_checked_by_name: user display name
    - last_checked_at: timestamp when it was checked
    """
    checked = 0
    most_recent_item: dict[str, Any] | None = None
    most_recent_ts = ""

    for item in items:
        if item.get("is_checked"):
            checked += 1
            ts = item.get("checked_at", "")
            if ts and ts > most_recent_ts:
                most_recent_item = item
                most_recent_ts = ts

    total = len(items)

    return {
        "total_items": total,
        "checked_items": checked,
        "unchecked_items": total - checked,
        "last_checked_item": most_recent_item.get("name") if most_recent_item else None,
        "last_checked_by": most_recent_item.get("checked_by") if most_recent_item else None,
        "last_checked_by_name": most_recent_item.get("checked_by_name") if most_recent_item else None,
        "last_checked_at": most_recent_item.get("checked_at") if most_recent_item else None,
    }


class FamilyListsCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Coordinator to manage fetching data from FamilyLists API."""

    def __init__(
        self,
        hass: HomeAssistant,
        client: FamilyListsClient,
        update_interval: int,
    ) -> None:
        """Initialize the coordinator."""
        super().__init__(
            hass,
            _LOGGER,
            name="FamilyLists",
            update_interval=timedelta(seconds=update_interval),
        )
        self.client = client

    async def _async_update_data(self) -> dict[str, Any]:
        """Fetch data from API."""
        try:
            lists = await self.client.get_lists()
            # Build a dict keyed by list ID for easy lookup
            result: dict[str, Any] = {}
            for lst in lists:
                list_id = lst["id"]
                # Fetch items for each list
                items = await self.client.get_list_items(list_id)

                # Process items in single pass for efficiency
                item_stats = _process_items(items)

                # Get sharing info from list response
                share_count = lst.get("share_count", 0)
                is_shared = lst.get("is_shared", share_count > 0)

                result[list_id] = {
                    **lst,
                    "items": items,
                    "is_shared": is_shared,
                    "share_count": share_count,
                    **item_stats,
                }
            return result
        except FamilyListsApiError as err:
            raise UpdateFailed(f"Error fetching data: {err}") from err
