"""API client for FamilyLists backend."""

from __future__ import annotations

import logging
from typing import Any

import asyncio

import aiohttp

_LOGGER = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 10


class FamilyListsApiError(Exception):
    """Exception for API errors."""


class FamilyListsClient:
    """Async client for FamilyLists API."""

    def __init__(
        self,
        url: str,
        api_key: str,
        session: aiohttp.ClientSession,
    ) -> None:
        """Initialize the client."""
        self._url = url.rstrip("/")
        self._api_key = api_key
        self._session = session

    @property
    def _headers(self) -> dict[str, str]:
        """Return headers for API requests."""
        headers = {"Content-Type": "application/json"}
        if self._api_key and self._api_key != "disabled":
            headers["X-API-Key"] = self._api_key
        return headers

    async def _request(
        self,
        method: str,
        endpoint: str,
        data: dict[str, Any] | None = None,
        timeout: int = DEFAULT_TIMEOUT,
    ) -> Any:
        """Make an API request."""
        url = f"{self._url}/api{endpoint}"
        try:
            async with asyncio.timeout(timeout):
                async with self._session.request(
                    method,
                    url,
                    headers=self._headers,
                    json=data,
                ) as response:
                    if response.status == 401:
                        raise FamilyListsApiError("Invalid API key")
                    if response.status == 404:
                        raise FamilyListsApiError(f"Not found: {endpoint}")
                    if response.status >= 400:
                        text = await response.text()
                        raise FamilyListsApiError(f"API error {response.status}: {text}")
                    return await response.json()
        except aiohttp.ClientError as err:
            raise FamilyListsApiError(f"Connection error: {err}") from err
        except TimeoutError as err:
            raise FamilyListsApiError(f"Request timeout after {timeout}s") from err

    async def test_connection(self) -> bool:
        """Test the connection to the backend."""
        try:
            await self._request("GET", "/health")
            return True
        except FamilyListsApiError:
            return False

    async def get_lists(self) -> list[dict[str, Any]]:
        """Fetch all lists."""
        return await self._request("GET", "/lists")

    async def get_list(self, list_id: str) -> dict[str, Any]:
        """Fetch a single list with items."""
        return await self._request("GET", f"/lists/{list_id}")

    async def get_list_items(
        self,
        list_id: str,
        status: str = "all",
    ) -> list[dict[str, Any]]:
        """Fetch items for a list.

        Args:
            list_id: The list ID
            status: Filter by status - "all", "checked", or "unchecked"
        """
        endpoint = f"/lists/{list_id}/items?status={status}"
        return await self._request("GET", endpoint)

    async def add_item(
        self,
        list_id: str,
        name: str,
        quantity: int = 1,
        category_id: str | None = None,
    ) -> dict[str, Any]:
        """Add an item to a list."""
        data: dict[str, Any] = {"name": name, "quantity": quantity}
        if category_id:
            data["category_id"] = category_id
        return await self._request("POST", f"/lists/{list_id}/items", data)

    async def check_item(self, item_id: str) -> dict[str, Any]:
        """Mark an item as checked."""
        return await self._request("POST", f"/items/{item_id}/check")

    async def uncheck_item(self, item_id: str) -> dict[str, Any]:
        """Mark an item as unchecked."""
        return await self._request("POST", f"/items/{item_id}/uncheck")

    async def delete_item(self, item_id: str) -> None:
        """Delete an item."""
        await self._request("DELETE", f"/items/{item_id}")

    async def clear_completed(self, list_id: str) -> dict[str, Any]:
        """Clear completed items from a list."""
        return await self._request("POST", f"/lists/{list_id}/clear")

    async def find_list_by_name(self, name: str) -> dict[str, Any] | None:
        """Find a list by name (case-insensitive)."""
        lists = await self.get_lists()
        name_lower = name.lower()
        for lst in lists:
            if lst["name"].lower() == name_lower:
                return lst
        return None

    async def find_item_by_name(
        self,
        list_id: str,
        name: str,
    ) -> dict[str, Any] | None:
        """Find an item by name in a list (case-insensitive)."""
        items = await self.get_list_items(list_id)
        name_lower = name.lower()
        for item in items:
            if item["name"].lower() == name_lower:
                return item
        return None
