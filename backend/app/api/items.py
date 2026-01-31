"""Item API endpoints."""

import asyncio

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_auth
from app.database import get_db
from app.dependencies import check_list_access, get_current_user
from app.models import User
from app.schemas import (
    ItemBatchCreate,
    ItemCheckRequest,
    ItemCreate,
    ItemResponse,
    ItemUpdate,
)
from app.services import item_service, list_service
from app.services.event_broadcaster import ListEvent, event_broadcaster

router = APIRouter(tags=["items"], dependencies=[Depends(get_auth)])


def item_to_response(item) -> dict:
    """Convert an Item model to a response dict with checked_by_name."""
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


def publish_event(event: ListEvent) -> None:
    """Publish an event to the broadcaster.

    This runs the async publish in a new event loop since we're
    calling from sync endpoints.
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If there's a running loop, create a task
            asyncio.create_task(event_broadcaster.publish(event))
        else:
            # No running loop, run synchronously
            loop.run_until_complete(event_broadcaster.publish(event))
    except RuntimeError:
        # No event loop exists, create one
        asyncio.run(event_broadcaster.publish(event))


@router.get("/lists/{list_id}/items", response_model=list[ItemResponse])
def get_items(
    list_id: str,
    status: str = Query("all", pattern="^(all|checked|unchecked)$"),
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get items for a list, optionally filtered by status."""
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    check_list_access(db, list_id, current_user, require_edit=False)

    items = item_service.get_items_by_list(db, list_id, status=status)
    return [item_to_response(item) for item in items]


@router.post("/lists/{list_id}/items", response_model=list[ItemResponse], status_code=201)
def create_items(
    list_id: str,
    data: ItemCreate | ItemBatchCreate,
    background_tasks: BackgroundTasks,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create one or more items."""
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    check_list_access(db, list_id, current_user, require_edit=True)

    if isinstance(data, ItemBatchCreate):
        items = item_service.create_items_batch(db, list_id, data.items)
    else:
        items = [item_service.create_item(db, list_id, data)]

    # Publish events for created items
    for item in items:
        background_tasks.add_task(
            publish_event,
            ListEvent(
                event_type="item_created",
                list_id=list_id,
                item_id=item.id,
                item_name=item.name,
                user_id=current_user.id if current_user else None,
                user_name=current_user.display_name if current_user else None,
            ),
        )

    return [item_to_response(item) for item in items]


@router.put("/items/{item_id}", response_model=ItemResponse)
def update_item(
    item_id: str,
    data: ItemUpdate,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an item."""
    item = item_service.get_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    check_list_access(db, item.list_id, current_user, require_edit=True)

    updated = item_service.update_item(db, item, data)
    return item_to_response(updated)


@router.delete("/items/{item_id}", status_code=204)
def delete_item(
    item_id: str,
    background_tasks: BackgroundTasks,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an item."""
    item = item_service.get_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    check_list_access(db, item.list_id, current_user, require_edit=True)

    # Capture item info before deletion
    list_id = item.list_id
    item_name = item.name

    item_service.delete_item(db, item)

    # Publish delete event
    background_tasks.add_task(
        publish_event,
        ListEvent(
            event_type="item_deleted",
            list_id=list_id,
            item_id=item_id,
            item_name=item_name,
            user_id=current_user.id if current_user else None,
            user_name=current_user.display_name if current_user else None,
        ),
    )


@router.post("/items/{item_id}/check", response_model=ItemResponse)
def check_item(
    item_id: str,
    background_tasks: BackgroundTasks,
    data: ItemCheckRequest | None = None,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark an item as checked."""
    item = item_service.get_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    check_list_access(db, item.list_id, current_user, require_edit=True)

    # Use current user's ID if available and no user_id provided
    user_id = data.user_id if data and data.user_id else (current_user.id if current_user else None)
    checked = item_service.check_item(db, item, user_id=user_id)

    # Publish check event
    background_tasks.add_task(
        publish_event,
        ListEvent(
            event_type="item_checked",
            list_id=item.list_id,
            item_id=item_id,
            item_name=item.name,
            user_id=current_user.id if current_user else None,
            user_name=current_user.display_name if current_user else None,
        ),
    )

    return item_to_response(checked)


@router.post("/items/{item_id}/uncheck", response_model=ItemResponse)
def uncheck_item(
    item_id: str,
    background_tasks: BackgroundTasks,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark an item as unchecked."""
    item = item_service.get_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    check_list_access(db, item.list_id, current_user, require_edit=True)

    unchecked = item_service.uncheck_item(db, item)

    # Publish uncheck event
    background_tasks.add_task(
        publish_event,
        ListEvent(
            event_type="item_unchecked",
            list_id=item.list_id,
            item_id=item_id,
            item_name=item.name,
            user_id=current_user.id if current_user else None,
            user_name=current_user.display_name if current_user else None,
        ),
    )

    return item_to_response(unchecked)


@router.post("/lists/{list_id}/clear", status_code=200)
def clear_checked_items(
    list_id: str,
    background_tasks: BackgroundTasks,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Clear all checked items from a list."""
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    check_list_access(db, list_id, current_user, require_edit=True)

    count = item_service.clear_checked_items(db, list_id)

    # Publish clear event
    background_tasks.add_task(
        publish_event,
        ListEvent(
            event_type="items_cleared",
            list_id=list_id,
            user_id=current_user.id if current_user else None,
            user_name=current_user.display_name if current_user else None,
        ),
    )

    return {"deleted_count": count}


@router.post("/lists/{list_id}/restore", status_code=200)
def restore_checked_items(
    list_id: str,
    background_tasks: BackgroundTasks,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Restore (uncheck) all checked items in a list."""
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    check_list_access(db, list_id, current_user, require_edit=True)

    count = item_service.restore_checked_items(db, list_id)

    # Publish restore event
    background_tasks.add_task(
        publish_event,
        ListEvent(
            event_type="items_restored",
            list_id=list_id,
            user_id=current_user.id if current_user else None,
            user_name=current_user.display_name if current_user else None,
        ),
    )

    return {"restored_count": count}
