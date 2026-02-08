"""Shared serialization utilities for API responses."""

import logging

from app.models import Item

logger = logging.getLogger(__name__)


def item_to_response(item: Item) -> dict:
    """Convert an Item model to a response dict with checked_by_name.

    This is shared between items.py and lists.py to ensure consistent
    serialization of items across endpoints.
    """
    # Safely get checked_by_name with defensive error handling
    checked_by_name = None
    if item.checked_by_user:
        try:
            checked_by_name = item.checked_by_user.display_name
        except AttributeError as e:
            logger.warning(
                f"Failed to get checked_by_name for item {item.id}: {type(e).__name__}: {e}"
            )

    # Safely get assigned_to_name
    assigned_to_name = None
    if item.assigned_to:
        try:
            if item.assigned_to_user:
                assigned_to_name = item.assigned_to_user.display_name
        except AttributeError as e:
            logger.warning(
                f"Failed to get assigned_to_name for item {item.id}: {type(e).__name__}: {e}"
            )

    return {
        "id": item.id,
        "list_id": item.list_id,
        "name": item.name,
        "quantity": item.quantity,
        "notes": item.notes,
        "category_id": item.category_id,
        "is_checked": item.is_checked,
        "checked_by": item.checked_by,
        "checked_by_name": checked_by_name,
        "checked_at": item.checked_at,
        "magnitude": item.magnitude,
        "assigned_to": item.assigned_to,
        "assigned_to_name": assigned_to_name,
        "sort_order": item.sort_order,
        "created_at": item.created_at or "",
        "updated_at": item.updated_at or "",
    }
