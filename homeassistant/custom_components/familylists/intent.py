"""Intent handlers for FamilyLists voice commands."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from homeassistant.helpers import intent

from .const import DOMAIN

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .coordinator import FamilyListsCoordinator

_LOGGER = logging.getLogger(__name__)

INTENT_ADD_ITEM = "FamilyListsAddItem"
INTENT_CHECK_ITEM = "FamilyListsCheckItem"
INTENT_UNCHECK_ITEM = "FamilyListsUncheckItem"
INTENT_CLEAR_COMPLETED = "FamilyListsClearCompleted"
INTENT_GET_ITEMS = "FamilyListsGetItems"


def _get_coordinator(hass: HomeAssistant) -> FamilyListsCoordinator | None:
    """Get the first available coordinator."""
    if DOMAIN in hass.data and hass.data[DOMAIN]:
        return next(iter(hass.data[DOMAIN].values()))
    return None


class FamilyListsAddItemIntent(intent.IntentHandler):
    """Handle AddItem intent."""

    intent_type = INTENT_ADD_ITEM
    slot_schema = {
        "item": str,
        "list_name": str,
    }

    async def async_handle(self, intent_obj: intent.Intent) -> intent.IntentResponse:
        """Handle the intent."""
        hass = intent_obj.hass
        slots = self.async_validate_slots(intent_obj.slots)
        item_name = slots["item"]["value"]
        list_name = slots["list_name"]["value"]

        coordinator = _get_coordinator(hass)
        if not coordinator:
            raise intent.IntentHandleError("FamilyLists is not configured")

        try:
            lst = await coordinator.client.find_list_by_name(list_name)
            if not lst:
                raise intent.IntentHandleError(f"I couldn't find a list called {list_name}")

            await coordinator.client.add_item(lst["id"], item_name)
            await coordinator.async_request_refresh()

            response = intent_obj.create_response()
            response.async_set_speech(f"Added {item_name} to {lst['name']}")
            return response

        except Exception as err:
            _LOGGER.error("Failed to add item via intent: %s", err)
            raise intent.IntentHandleError(f"Sorry, I couldn't add {item_name}") from err


class FamilyListsCheckItemIntent(intent.IntentHandler):
    """Handle CheckItem intent."""

    intent_type = INTENT_CHECK_ITEM
    slot_schema = {
        "item": str,
        "list_name": str,
    }

    async def async_handle(self, intent_obj: intent.Intent) -> intent.IntentResponse:
        """Handle the intent."""
        hass = intent_obj.hass
        slots = self.async_validate_slots(intent_obj.slots)
        item_name = slots["item"]["value"]
        list_name = slots["list_name"]["value"]

        coordinator = _get_coordinator(hass)
        if not coordinator:
            raise intent.IntentHandleError("FamilyLists is not configured")

        try:
            lst = await coordinator.client.find_list_by_name(list_name)
            if not lst:
                raise intent.IntentHandleError(f"I couldn't find a list called {list_name}")

            item = await coordinator.client.find_item_by_name(lst["id"], item_name)
            if not item:
                raise intent.IntentHandleError(f"I couldn't find {item_name} on {lst['name']}")

            await coordinator.client.check_item(item["id"])
            await coordinator.async_request_refresh()

            response = intent_obj.create_response()
            response.async_set_speech(f"Checked off {item_name}")
            return response

        except intent.IntentHandleError:
            raise
        except Exception as err:
            _LOGGER.error("Failed to check item via intent: %s", err)
            raise intent.IntentHandleError(f"Sorry, I couldn't check off {item_name}") from err


class FamilyListsUncheckItemIntent(intent.IntentHandler):
    """Handle UncheckItem intent."""

    intent_type = INTENT_UNCHECK_ITEM
    slot_schema = {
        "item": str,
        "list_name": str,
    }

    async def async_handle(self, intent_obj: intent.Intent) -> intent.IntentResponse:
        """Handle the intent."""
        hass = intent_obj.hass
        slots = self.async_validate_slots(intent_obj.slots)
        item_name = slots["item"]["value"]
        list_name = slots["list_name"]["value"]

        coordinator = _get_coordinator(hass)
        if not coordinator:
            raise intent.IntentHandleError("FamilyLists is not configured")

        try:
            lst = await coordinator.client.find_list_by_name(list_name)
            if not lst:
                raise intent.IntentHandleError(f"I couldn't find a list called {list_name}")

            item = await coordinator.client.find_item_by_name(lst["id"], item_name)
            if not item:
                raise intent.IntentHandleError(f"I couldn't find {item_name} on {lst['name']}")

            await coordinator.client.uncheck_item(item["id"])
            await coordinator.async_request_refresh()

            response = intent_obj.create_response()
            response.async_set_speech(f"Put {item_name} back on the list")
            return response

        except intent.IntentHandleError:
            raise
        except Exception as err:
            _LOGGER.error("Failed to uncheck item via intent: %s", err)
            raise intent.IntentHandleError(f"Sorry, I couldn't uncheck {item_name}") from err


class FamilyListsClearCompletedIntent(intent.IntentHandler):
    """Handle ClearCompleted intent."""

    intent_type = INTENT_CLEAR_COMPLETED
    slot_schema = {
        "list_name": str,
    }

    async def async_handle(self, intent_obj: intent.Intent) -> intent.IntentResponse:
        """Handle the intent."""
        hass = intent_obj.hass
        slots = self.async_validate_slots(intent_obj.slots)
        list_name = slots["list_name"]["value"]

        coordinator = _get_coordinator(hass)
        if not coordinator:
            raise intent.IntentHandleError("FamilyLists is not configured")

        try:
            lst = await coordinator.client.find_list_by_name(list_name)
            if not lst:
                raise intent.IntentHandleError(f"I couldn't find a list called {list_name}")

            result = await coordinator.client.clear_completed(lst["id"])
            await coordinator.async_request_refresh()

            count = result.get("deleted_count", 0)
            response = intent_obj.create_response()
            if count > 0:
                response.async_set_speech(f"Cleared {count} completed items from {lst['name']}")
            else:
                response.async_set_speech(f"There were no completed items to clear from {lst['name']}")
            return response

        except intent.IntentHandleError:
            raise
        except Exception as err:
            _LOGGER.error("Failed to clear completed via intent: %s", err)
            raise intent.IntentHandleError("Sorry, I couldn't clear the list") from err


class FamilyListsGetItemsIntent(intent.IntentHandler):
    """Handle GetItems intent."""

    intent_type = INTENT_GET_ITEMS
    slot_schema = {
        "list_name": str,
    }

    async def async_handle(self, intent_obj: intent.Intent) -> intent.IntentResponse:
        """Handle the intent."""
        hass = intent_obj.hass
        slots = self.async_validate_slots(intent_obj.slots)
        list_name = slots["list_name"]["value"]

        coordinator = _get_coordinator(hass)
        if not coordinator:
            raise intent.IntentHandleError("FamilyLists is not configured")

        try:
            lst = await coordinator.client.find_list_by_name(list_name)
            if not lst:
                raise intent.IntentHandleError(f"I couldn't find a list called {list_name}")

            items = await coordinator.client.get_list_items(lst["id"], status="unchecked")

            response = intent_obj.create_response()
            if not items:
                response.async_set_speech(f"Your {lst['name']} is empty")
            elif len(items) == 1:
                response.async_set_speech(f"You have {items[0]['name']} on your {lst['name']}")
            elif len(items) <= 5:
                item_names = [item["name"] for item in items]
                items_text = ", ".join(item_names[:-1]) + f" and {item_names[-1]}"
                response.async_set_speech(f"You have {len(items)} items on your {lst['name']}: {items_text}")
            else:
                # Too many to read, just give count and first few
                item_names = [item["name"] for item in items[:3]]
                response.async_set_speech(
                    f"You have {len(items)} items on your {lst['name']}, "
                    f"including {', '.join(item_names)}, and more"
                )
            return response

        except intent.IntentHandleError:
            raise
        except Exception as err:
            _LOGGER.error("Failed to get items via intent: %s", err)
            raise intent.IntentHandleError("Sorry, I couldn't read the list") from err


async def async_register_intents(hass: HomeAssistant) -> None:
    """Register all intent handlers."""
    intent.async_register(hass, FamilyListsAddItemIntent())
    intent.async_register(hass, FamilyListsCheckItemIntent())
    intent.async_register(hass, FamilyListsUncheckItemIntent())
    intent.async_register(hass, FamilyListsClearCompletedIntent())
    intent.async_register(hass, FamilyListsGetItemsIntent())
