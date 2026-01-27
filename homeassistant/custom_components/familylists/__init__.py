"""FamilyLists integration for Home Assistant."""

from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_API_KEY, Platform
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import FamilyListsApiError, FamilyListsClient
from .const import (
    CONF_BACKEND_URL,
    CONF_POLL_INTERVAL,
    DEFAULT_POLL_INTERVAL,
    DOMAIN,
)
from .coordinator import FamilyListsCoordinator

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.SENSOR]

# Service schemas
SERVICE_ADD_ITEM = "add_item"
SERVICE_CHECK_ITEM = "check_item"
SERVICE_UNCHECK_ITEM = "uncheck_item"
SERVICE_CLEAR_COMPLETED = "clear_completed"
SERVICE_REFRESH = "refresh"

SERVICE_SCHEMA_ADD_ITEM = vol.Schema(
    {
        vol.Required("list_name"): cv.string,
        vol.Required("item"): cv.string,
        vol.Optional("quantity", default=1): cv.positive_int,
    }
)

SERVICE_SCHEMA_ITEM = vol.Schema(
    {
        vol.Required("list_name"): cv.string,
        vol.Required("item"): cv.string,
    }
)

SERVICE_SCHEMA_LIST = vol.Schema(
    {
        vol.Required("list_name"): cv.string,
    }
)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up FamilyLists from a config entry."""
    session = async_get_clientsession(hass)
    client = FamilyListsClient(
        entry.data[CONF_BACKEND_URL],
        entry.data.get(CONF_API_KEY, ""),
        session,
    )

    # Test connection
    if not await client.test_connection():
        _LOGGER.error("Cannot connect to FamilyLists backend")
        return False

    # Create coordinator
    coordinator = FamilyListsCoordinator(
        hass,
        client,
        entry.data.get(CONF_POLL_INTERVAL, DEFAULT_POLL_INTERVAL),
    )

    # Fetch initial data
    await coordinator.async_config_entry_first_refresh()

    # Store coordinator
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = coordinator

    # Set up platforms
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # Register services (only once)
    if not hass.services.has_service(DOMAIN, SERVICE_ADD_ITEM):
        await _async_register_services(hass)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    if unload_ok := await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        hass.data[DOMAIN].pop(entry.entry_id)

        # Remove services if no more entries
        if not hass.data[DOMAIN]:
            for service in [
                SERVICE_ADD_ITEM,
                SERVICE_CHECK_ITEM,
                SERVICE_UNCHECK_ITEM,
                SERVICE_CLEAR_COMPLETED,
                SERVICE_REFRESH,
            ]:
                hass.services.async_remove(DOMAIN, service)

    return unload_ok


async def _async_register_services(hass: HomeAssistant) -> None:
    """Register FamilyLists services."""

    def _get_coordinator() -> FamilyListsCoordinator | None:
        """Get the first available coordinator."""
        if DOMAIN in hass.data and hass.data[DOMAIN]:
            return next(iter(hass.data[DOMAIN].values()))
        return None

    async def async_add_item(call: ServiceCall) -> None:
        """Handle add_item service call."""
        coordinator = _get_coordinator()
        if not coordinator:
            _LOGGER.error("No FamilyLists integration configured")
            return

        list_name = call.data["list_name"]
        item_name = call.data["item"]
        quantity = call.data.get("quantity", 1)

        try:
            lst = await coordinator.client.find_list_by_name(list_name)
            if not lst:
                _LOGGER.error("List not found: %s", list_name)
                return

            await coordinator.client.add_item(lst["id"], item_name, quantity)
            await coordinator.async_request_refresh()
            _LOGGER.info("Added %s to %s", item_name, list_name)
        except FamilyListsApiError as err:
            _LOGGER.error("Failed to add item: %s", err)

    async def async_check_item(call: ServiceCall) -> None:
        """Handle check_item service call."""
        coordinator = _get_coordinator()
        if not coordinator:
            _LOGGER.error("No FamilyLists integration configured")
            return

        list_name = call.data["list_name"]
        item_name = call.data["item"]

        try:
            lst = await coordinator.client.find_list_by_name(list_name)
            if not lst:
                _LOGGER.error("List not found: %s", list_name)
                return

            item = await coordinator.client.find_item_by_name(lst["id"], item_name)
            if not item:
                _LOGGER.error("Item not found: %s in %s", item_name, list_name)
                return

            await coordinator.client.check_item(item["id"])
            await coordinator.async_request_refresh()
            _LOGGER.info("Checked %s in %s", item_name, list_name)
        except FamilyListsApiError as err:
            _LOGGER.error("Failed to check item: %s", err)

    async def async_uncheck_item(call: ServiceCall) -> None:
        """Handle uncheck_item service call."""
        coordinator = _get_coordinator()
        if not coordinator:
            _LOGGER.error("No FamilyLists integration configured")
            return

        list_name = call.data["list_name"]
        item_name = call.data["item"]

        try:
            lst = await coordinator.client.find_list_by_name(list_name)
            if not lst:
                _LOGGER.error("List not found: %s", list_name)
                return

            item = await coordinator.client.find_item_by_name(lst["id"], item_name)
            if not item:
                _LOGGER.error("Item not found: %s in %s", item_name, list_name)
                return

            await coordinator.client.uncheck_item(item["id"])
            await coordinator.async_request_refresh()
            _LOGGER.info("Unchecked %s in %s", item_name, list_name)
        except FamilyListsApiError as err:
            _LOGGER.error("Failed to uncheck item: %s", err)

    async def async_clear_completed(call: ServiceCall) -> None:
        """Handle clear_completed service call."""
        coordinator = _get_coordinator()
        if not coordinator:
            _LOGGER.error("No FamilyLists integration configured")
            return

        list_name = call.data["list_name"]

        try:
            lst = await coordinator.client.find_list_by_name(list_name)
            if not lst:
                _LOGGER.error("List not found: %s", list_name)
                return

            await coordinator.client.clear_completed(lst["id"])
            await coordinator.async_request_refresh()
            _LOGGER.info("Cleared completed items from %s", list_name)
        except FamilyListsApiError as err:
            _LOGGER.error("Failed to clear completed: %s", err)

    async def async_refresh(call: ServiceCall) -> None:
        """Handle refresh service call."""
        coordinator = _get_coordinator()
        if not coordinator:
            _LOGGER.error("No FamilyLists integration configured")
            return

        await coordinator.async_request_refresh()
        _LOGGER.info("Refreshed FamilyLists data")

    # Register all services
    hass.services.async_register(
        DOMAIN, SERVICE_ADD_ITEM, async_add_item, schema=SERVICE_SCHEMA_ADD_ITEM
    )
    hass.services.async_register(
        DOMAIN, SERVICE_CHECK_ITEM, async_check_item, schema=SERVICE_SCHEMA_ITEM
    )
    hass.services.async_register(
        DOMAIN, SERVICE_UNCHECK_ITEM, async_uncheck_item, schema=SERVICE_SCHEMA_ITEM
    )
    hass.services.async_register(
        DOMAIN, SERVICE_CLEAR_COMPLETED, async_clear_completed, schema=SERVICE_SCHEMA_LIST
    )
    hass.services.async_register(DOMAIN, SERVICE_REFRESH, async_refresh)
