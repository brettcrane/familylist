"""Todo platform for FamilyLists."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from homeassistant.components.todo import (
    TodoItem,
    TodoItemStatus,
    TodoListEntity,
    TodoListEntityFeature,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .api import FamilyListsApiError
from .const import DOMAIN
from .coordinator import FamilyListsCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up FamilyLists todo entities from a config entry."""
    coordinator: FamilyListsCoordinator = hass.data[DOMAIN][entry.entry_id]

    entities = [
        FamilyListsTodoEntity(coordinator, list_id, list_data)
        for list_id, list_data in coordinator.data.items()
    ]
    async_add_entities(entities)


class FamilyListsTodoEntity(CoordinatorEntity[FamilyListsCoordinator], TodoListEntity):
    """Todo entity representing a FamilyLists list."""

    _attr_has_entity_name = True
    # Note: Description is computed from category/quantity/notes and is read-only.
    # Use the PWA for full editing capabilities (categories, quantities, notes).
    _attr_supported_features = (
        TodoListEntityFeature.CREATE_TODO_ITEM
        | TodoListEntityFeature.UPDATE_TODO_ITEM
        | TodoListEntityFeature.DELETE_TODO_ITEM
    )

    def __init__(
        self,
        coordinator: FamilyListsCoordinator,
        list_id: str,
        list_data: dict[str, Any],
    ) -> None:
        """Initialize the todo entity."""
        super().__init__(coordinator)
        self._list_id = list_id
        self._attr_unique_id = f"familylists_todo_{list_id}"
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
    def todo_items(self) -> list[TodoItem]:
        """Return the todo items from the list."""
        if data := self._list_data:
            items = data.get("items", [])
            return [self._build_todo_item(item) for item in items]
        return []

    def _build_todo_item(self, item: dict[str, Any]) -> TodoItem:
        """Build a TodoItem from FamilyLists item data.

        Summary: Clean item name (no quantity)
        Description: "[Category] x2 | notes" format (compact)
        """
        # Summary is just the item name (clean)
        summary = item["name"]

        # Build description: "[Category] x2 | notes"
        parts = []

        # Category part with optional quantity
        if category := item.get("category"):
            cat_part = f"[{category['name']}]"
            quantity = item.get("quantity", 1)
            if quantity > 1:
                cat_part += f" x{quantity}"
            parts.append(cat_part)
        elif item.get("quantity", 1) > 1:
            # No category but has quantity
            parts.append(f"x{item['quantity']}")

        # Notes part
        if notes := item.get("notes"):
            parts.append(notes)

        description = " | ".join(parts) if parts else None

        return TodoItem(
            summary=summary,
            uid=item["id"],
            status=(
                TodoItemStatus.COMPLETED
                if item.get("is_checked")
                else TodoItemStatus.NEEDS_ACTION
            ),
            description=description,
        )

    async def async_create_todo_item(self, item: TodoItem) -> None:
        """Create a new item on the list."""
        try:
            # Summary is the item name
            name = item.summary.strip()

            # Default quantity
            quantity = 1

            await self.coordinator.client.add_item(
                self._list_id,
                name,
                quantity=quantity,
            )
            await self.coordinator.async_request_refresh()
        except FamilyListsApiError as err:
            _LOGGER.error("Failed to create item %s: %s", item.summary, err)
            raise HomeAssistantError(f"Failed to create item: {err}") from err

    async def async_update_todo_item(self, item: TodoItem) -> None:
        """Update an item (check/uncheck, rename)."""
        try:
            # Get current item state from coordinator
            if not self._list_data:
                raise HomeAssistantError("List data not available")

            items_dict = {i["id"]: i for i in self._list_data.get("items", [])}
            old_item = items_dict.get(item.uid)

            if not old_item:
                raise HomeAssistantError(f"Item {item.uid} not found")

            old_status = (
                TodoItemStatus.COMPLETED
                if old_item.get("is_checked")
                else TodoItemStatus.NEEDS_ACTION
            )

            # Handle status change (check/uncheck)
            if item.status != old_status:
                if item.status == TodoItemStatus.COMPLETED:
                    await self.coordinator.client.check_item(item.uid)
                else:
                    await self.coordinator.client.uncheck_item(item.uid)

            # Handle name change
            new_name = item.summary.strip()
            if new_name != old_item["name"]:
                await self.coordinator.client.update_item(
                    item.uid,
                    name=new_name,
                )

            await self.coordinator.async_request_refresh()
        except FamilyListsApiError as err:
            _LOGGER.error("Failed to update item %s: %s", item.summary, err)
            raise HomeAssistantError(f"Failed to update item: {err}") from err

    async def async_delete_todo_items(self, uids: list[str]) -> None:
        """Delete items from the list."""
        try:
            # Delete items in parallel for better performance
            await asyncio.gather(
                *[self.coordinator.client.delete_item(uid) for uid in uids]
            )
            await self.coordinator.async_request_refresh()
        except FamilyListsApiError as err:
            _LOGGER.error("Failed to delete items: %s", err)
            raise HomeAssistantError(f"Failed to delete items: {err}") from err

    @callback
    def _handle_coordinator_update(self) -> None:
        """Handle updated data from the coordinator."""
        self.async_write_ha_state()
