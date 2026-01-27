"""Config flow for FamilyLists integration."""

from __future__ import annotations

import logging
from typing import Any

import aiohttp
import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.const import CONF_API_KEY
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import FamilyListsClient
from .const import (
    CONF_BACKEND_URL,
    CONF_POLL_INTERVAL,
    DEFAULT_BACKEND_URL,
    DEFAULT_POLL_INTERVAL,
    DOMAIN,
)

_LOGGER = logging.getLogger(__name__)

STEP_USER_DATA_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_BACKEND_URL, default=DEFAULT_BACKEND_URL): str,
        vol.Optional(CONF_API_KEY, default=""): str,
        vol.Optional(CONF_POLL_INTERVAL, default=DEFAULT_POLL_INTERVAL): int,
    }
)


class FamilyListsConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for FamilyLists."""

    VERSION = 1

    async def async_step_user(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> ConfigFlowResult:
        """Handle the initial step."""
        errors: dict[str, str] = {}

        if user_input is not None:
            # Test connection to backend
            session = async_get_clientsession(self.hass)
            client = FamilyListsClient(
                user_input[CONF_BACKEND_URL],
                user_input.get(CONF_API_KEY, ""),
                session,
            )

            if await client.test_connection():
                # Prevent duplicate entries
                await self.async_set_unique_id(user_input[CONF_BACKEND_URL])
                self._abort_if_unique_id_configured()

                return self.async_create_entry(
                    title="FamilyLists",
                    data=user_input,
                )
            else:
                errors["base"] = "cannot_connect"

        return self.async_show_form(
            step_id="user",
            data_schema=STEP_USER_DATA_SCHEMA,
            errors=errors,
        )
