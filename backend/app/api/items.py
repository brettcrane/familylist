"""Item API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
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

router = APIRouter(tags=["items"], dependencies=[Depends(get_auth)])


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
    return items


@router.post("/lists/{list_id}/items", response_model=list[ItemResponse], status_code=201)
def create_items(
    list_id: str,
    data: ItemCreate | ItemBatchCreate,
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

    return items


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
    return updated


@router.delete("/items/{item_id}", status_code=204)
def delete_item(
    item_id: str,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an item."""
    item = item_service.get_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    check_list_access(db, item.list_id, current_user, require_edit=True)

    item_service.delete_item(db, item)


@router.post("/items/{item_id}/check", response_model=ItemResponse)
def check_item(
    item_id: str,
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
    return checked


@router.post("/items/{item_id}/uncheck", response_model=ItemResponse)
def uncheck_item(
    item_id: str,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark an item as unchecked."""
    item = item_service.get_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    check_list_access(db, item.list_id, current_user, require_edit=True)

    unchecked = item_service.uncheck_item(db, item)
    return unchecked


@router.post("/lists/{list_id}/clear", status_code=200)
def clear_checked_items(
    list_id: str,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Clear all checked items from a list."""
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    check_list_access(db, list_id, current_user, require_edit=True)

    count = item_service.clear_checked_items(db, list_id)
    return {"deleted_count": count}


@router.post("/lists/{list_id}/restore", status_code=200)
def restore_checked_items(
    list_id: str,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Restore (uncheck) all checked items in a list."""
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    check_list_access(db, list_id, current_user, require_edit=True)

    count = item_service.restore_checked_items(db, list_id)
    return {"restored_count": count}
