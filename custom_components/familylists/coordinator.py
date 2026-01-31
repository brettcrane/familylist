"""Data update coordinator for FamilyLists."""

from __future__ import annotations

from datetime import timedelta
import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import FamilyListsApiError, FamilyListsClient

_LOGGER = logging.getLogger(__name__)


def _get_last_checked_info(items: list[dict[str, Any]]) -> dict[str, Any]:
    """Extract information about the most recently checked item.

    Returns a dict with:
    - last_checked_item: name of the item
    - last_checked_by: user ID who checked it
    - last_checked_by_name: user display name
    - last_checked_at: timestamp when it was checked
    """
    # Filter to only checked items with a checked_at timestamp
    checked_items = [
        item for item in items
        if item.get("is_checked") and item.get("checked_at")
    ]

    if not checked_items:
        return {
            "last_checked_item": None,
            "last_checked_by": None,
            "last_checked_by_name": None,
            "last_checked_at": None,
        }

    # Sort by checked_at descending to get most recent
    checked_items.sort(key=lambda x: x.get("checked_at", ""), reverse=True)
    most_recent = checked_items[0]

    return {
        "last_checked_item": most_recent.get("name"),
        "last_checked_by": most_recent.get("checked_by"),
        "last_checked_by_name": most_recent.get("checked_by_name"),
        "last_checked_at": most_recent.get("checked_at"),
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
                # Fetch items for each list to get counts
                items = await self.client.get_list_items(list_id)
                checked = sum(1 for item in items if item.get("is_checked"))
                unchecked = len(items) - checked

                # Get sharing info from list response
                share_count = lst.get("share_count", 0)
                is_shared = lst.get("is_shared", share_count > 0)

                # Get last checked info from items
                last_checked_info = _get_last_checked_info(items)

                result[list_id] = {
                    **lst,
                    "items": items,
                    "total_items": len(items),
                    "checked_items": checked,
                    "unchecked_items": unchecked,
                    "is_shared": is_shared,
                    "share_count": share_count,
                    **last_checked_info,
                }
            return result
        except FamilyListsApiError as err:
            raise UpdateFailed(f"Error fetching data: {err}") from err
