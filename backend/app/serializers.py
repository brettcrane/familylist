"""Shared serialization utilities for API responses."""

from app.models import Item


def item_to_response(item: Item) -> dict:
    """Convert an Item model to a response dict with checked_by_name.

    This is shared between items.py and lists.py to ensure consistent
    serialization of items across endpoints.
    """
    return {
        "id": item.id,
        "list_id": item.list_id,
        "name": item.name,
        "quantity": item.quantity,
        "notes": item.notes,
        "category_id": item.category_id,
        "is_checked": item.is_checked,
        "checked_by": item.checked_by,
        "checked_by_name": item.checked_by_user.display_name if item.checked_by_user else None,
        "checked_at": item.checked_at,
        "sort_order": item.sort_order,
        "created_at": item.created_at or "",
        "updated_at": item.updated_at or "",
    }
