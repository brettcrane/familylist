"""Sensor platform for FamilyLists."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import (
    ATTR_CHECKED_ITEMS,
    ATTR_LAST_UPDATED,
    ATTR_LAST_UPDATED_BY,
    ATTR_LIST_ID,
    ATTR_LIST_TYPE,
    ATTR_TOTAL_ITEMS,
    ATTR_UNCHECKED_ITEMS,
    DOMAIN,
)
from .coordinator import FamilyListsCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up FamilyLists sensors from a config entry."""
    coordinator: FamilyListsCoordinator = hass.data[DOMAIN][entry.entry_id]

    entities = [
        FamilyListsSensor(coordinator, list_id, list_data)
        for list_id, list_data in coordinator.data.items()
    ]
    async_add_entities(entities)


class FamilyListsSensor(CoordinatorEntity[FamilyListsCoordinator], SensorEntity):
    """Sensor representing a FamilyLists list."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: FamilyListsCoordinator,
        list_id: str,
        list_data: dict[str, Any],
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self._list_id = list_id
        self._attr_unique_id = f"familylists_{list_id}"
        self._attr_name = list_data["name"]
        self._attr_icon = self._get_icon(list_data.get("type", "grocery"))

    def _get_icon(self, list_type: str) -> str:
        """Return icon based on list type."""
        icons = {
            "grocery": "mdi:cart",
            "packing": "mdi:bag-suitcase",
            "tasks": "mdi:checkbox-marked-outline",
        }
        return icons.get(list_type, "mdi:format-list-bulleted")

    @property
    def _list_data(self) -> dict[str, Any] | None:
        """Get current list data from coordinator."""
        if self.coordinator.data:
            return self.coordinator.data.get(self._list_id)
        return None

    @property
    def native_value(self) -> str:
        """Return the state of the sensor."""
        if data := self._list_data:
            count = data.get("unchecked_items", 0)
            return f"{count} item{'s' if count != 1 else ''}"
        return "unavailable"

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return additional state attributes."""
        if data := self._list_data:
            return {
                ATTR_LIST_ID: self._list_id,
                ATTR_LIST_TYPE: data.get("type", "grocery"),
                ATTR_TOTAL_ITEMS: data.get("total_items", 0),
                ATTR_CHECKED_ITEMS: data.get("checked_items", 0),
                ATTR_UNCHECKED_ITEMS: data.get("unchecked_items", 0),
                ATTR_LAST_UPDATED: data.get("updated_at"),
                ATTR_LAST_UPDATED_BY: data.get("updated_by"),
            }
        return {}

    @callback
    def _handle_coordinator_update(self) -> None:
        """Handle updated data from the coordinator."""
        self.async_write_ha_state()
