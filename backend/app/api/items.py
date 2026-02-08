"""Item API endpoints."""

import asyncio
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
from app.models import ListShare, User as UserModel
from app.services import item_service, list_service
from app.services.event_broadcaster import ListEvent, event_broadcaster
from app.services.notification_queue import notification_queue

logger = logging.getLogger(__name__)

router = APIRouter(tags=["items"], dependencies=[Depends(get_auth)])


def _validate_assigned_to(db: Session, assigned_to: str | None) -> None:
    """Validate that assigned_to references an existing user."""
    if assigned_to is None:
        return
    user = db.query(UserModel).filter(UserModel.id == assigned_to).first()
    if not user:
        raise HTTPException(
            status_code=422,
            detail=f"Cannot assign to user: user not found",
        )


def get_notification_recipients(db: Session, list_id: str) -> list[str]:
    """Get all user IDs who should receive notifications for a list.

    Returns list of user IDs (owner + shared users).
    Must be called before the request ends (while db session is active).
    """
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        return []

    recipient_ids: list[str] = []

    # Add owner
    if list_obj.owner_id:
        recipient_ids.append(list_obj.owner_id)

    # Add shared users
    shares = db.query(ListShare).filter(ListShare.list_id == list_id).all()
    for share in shares:
        if share.user_id not in recipient_ids:
            recipient_ids.append(share.user_id)

    return recipient_ids


async def publish_event_async(
    event: ListEvent,
    list_name: str,
    recipient_user_ids: list[str],
) -> None:
    """Publish an event to SSE broadcaster and queue push notification.

    This function is designed to be used with BackgroundTasks.add_task().
    It handles both real-time SSE updates and background push notifications.

    Args:
        event: The list event to publish
        list_name: Name of the list (for notification message)
        recipient_user_ids: Users to potentially notify (gathered before task started)
    """
    # Publish to SSE for live sync
    try:
        await event_broadcaster.publish(event)
        logger.debug(
            f"Successfully published {event.event_type} event for list {event.list_id}"
        )
    except (asyncio.QueueFull, asyncio.TimeoutError) as e:
        # Expected failures - log as warning, not error
        logger.warning(
            f"Event publish failed (expected): {type(e).__name__} for "
            f"event_type={event.event_type}, list_id={event.list_id}"
        )
    except Exception as e:
        # Unexpected failures - these indicate potential bugs
        logger.error(
            f"UNEXPECTED event publish failure: event_type={event.event_type}, "
            f"list_id={event.list_id}, item_id={event.item_id}, error={type(e).__name__}: {e}",
            exc_info=True,
        )

    # Queue push notification for background users
    if recipient_user_ids:
        try:
            await notification_queue.queue_event(
                list_id=event.list_id,
                list_name=list_name,
                event_type=event.event_type,
                item_name=event.item_name,
                actor_user_id=event.user_id or "",
                actor_name=event.user_name or "Someone",
                recipient_user_ids=recipient_user_ids,
            )
        except Exception as e:
            logger.error(
                f"Failed to queue push notification: {type(e).__name__}: {e}",
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

    # Validate assigned_to references
    if isinstance(data, ItemBatchCreate):
        for item_data in data.items:
            _validate_assigned_to(db, item_data.assigned_to)
        items = item_service.create_items_batch(db, list_id, data.items)
    else:
        _validate_assigned_to(db, data.assigned_to)
        items = [item_service.create_item(db, list_id, data)]

    # Get notification context before returning (db session still active)
    recipient_ids = get_notification_recipients(db, list_id)
    list_name = list_obj.name

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
            list_name,
            recipient_ids,
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

    # Validate assigned_to if being updated
    update_fields = data.model_dump(exclude_unset=True)
    if "assigned_to" in update_fields:
        _validate_assigned_to(db, data.assigned_to)

    updated = item_service.update_item(db, item, data)

    # Get notification context
    list_obj = list_service.get_list_by_id(db, item.list_id)
    recipient_ids = get_notification_recipients(db, item.list_id)
    list_name = list_obj.name if list_obj else "List"

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
        list_name,
        recipient_ids,
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

    # Get notification context before deletion
    list_obj = list_service.get_list_by_id(db, list_id)
    recipient_ids = get_notification_recipients(db, list_id)
    list_name = list_obj.name if list_obj else "List"

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
        list_name,
        recipient_ids,
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

    # Get notification context
    list_obj = list_service.get_list_by_id(db, item.list_id)
    recipient_ids = get_notification_recipients(db, item.list_id)
    list_name = list_obj.name if list_obj else "List"

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
        list_name,
        recipient_ids,
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

    # Get notification context
    list_obj = list_service.get_list_by_id(db, item.list_id)
    recipient_ids = get_notification_recipients(db, item.list_id)
    list_name = list_obj.name if list_obj else "List"

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
        list_name,
        recipient_ids,
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

    # Get notification context
    recipient_ids = get_notification_recipients(db, list_id)
    list_name = list_obj.name

    # Publish clear event
    background_tasks.add_task(
        publish_event_async,
        ListEvent(
            event_type="items_cleared",
            list_id=list_id,
            user_id=current_user.id if current_user else None,
            user_name=current_user.display_name if current_user else None,
        ),
        list_name,
        recipient_ids,
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

    # Get notification context
    recipient_ids = get_notification_recipients(db, list_id)
    list_name = list_obj.name

    # Publish restore event
    background_tasks.add_task(
        publish_event_async,
        ListEvent(
            event_type="items_restored",
            list_id=list_id,
            user_id=current_user.id if current_user else None,
            user_name=current_user.display_name if current_user else None,
        ),
        list_name,
        recipient_ids,
    )

    return {"restored_count": count}
