"""Data update coordinator for FamilyLists."""

from __future__ import annotations

from datetime import timedelta
import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import FamilyListsApiError, FamilyListsClient

_LOGGER = logging.getLogger(__name__)


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
                result[list_id] = {
                    **lst,
                    "items": items,
                    "total_items": len(items),
                    "checked_items": checked,
                    "unchecked_items": unchecked,
                }
            return result
        except FamilyListsApiError as err:
            raise UpdateFailed(f"Error fetching data: {err}") from err
