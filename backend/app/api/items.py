"""Item API endpoints."""

import logging

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
from app.serializers import item_to_response
from app.services import item_service, list_service
from app.services.event_broadcaster import ListEvent, event_broadcaster

logger = logging.getLogger(__name__)

router = APIRouter(tags=["items"], dependencies=[Depends(get_auth)])


async def publish_event_async(event: ListEvent) -> None:
    """Publish an event to the broadcaster asynchronously.

    This function is designed to be used with BackgroundTasks.add_task().
    Properly handles and logs any errors during event publishing.
    """
    try:
        await event_broadcaster.publish(event)
        logger.debug(
            f"Successfully published {event.event_type} event for list {event.list_id}"
        )
    except Exception as e:
        # Log the error but don't re-raise - event publishing failures
        # should not affect the main request
        logger.error(
            f"Failed to publish event: event_type={event.event_type}, "
            f"list_id={event.list_id}, item_id={event.item_id}, error={e}",
            exc_info=True,
        )


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
            publish_event_async,
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
    background_tasks: BackgroundTasks,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an item."""
    item = item_service.get_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    check_list_access(db, item.list_id, current_user, require_edit=True)

    updated = item_service.update_item(db, item, data)

    # Publish update event
    background_tasks.add_task(
        publish_event_async,
        ListEvent(
            event_type="item_updated",
            list_id=item.list_id,
            item_id=item_id,
            item_name=updated.name,
            user_id=current_user.id if current_user else None,
            user_name=current_user.display_name if current_user else None,
        ),
    )

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
        publish_event_async,
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
        publish_event_async,
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
        publish_event_async,
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
        publish_event_async,
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
        publish_event_async,
        ListEvent(
            event_type="items_restored",
            list_id=list_id,
            user_id=current_user.id if current_user else None,
            user_name=current_user.display_name if current_user else None,
        ),
    )

    return {"restored_count": count}
