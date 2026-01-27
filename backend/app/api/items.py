"""Item API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import verify_api_key
from app.database import get_db
from app.schemas import (
    ItemBatchCreate,
    ItemCheckRequest,
    ItemCreate,
    ItemResponse,
    ItemUpdate,
)
from app.services import item_service, list_service

router = APIRouter(tags=["items"], dependencies=[Depends(verify_api_key)])


@router.get("/lists/{list_id}/items", response_model=list[ItemResponse])
def get_items(
    list_id: str,
    status: str = Query("all", pattern="^(all|checked|unchecked)$"),
    db: Session = Depends(get_db),
):
    """Get items for a list, optionally filtered by status."""
    # Verify list exists
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    items = item_service.get_items_by_list(db, list_id, status=status)
    return items


@router.post("/lists/{list_id}/items", response_model=list[ItemResponse], status_code=201)
def create_items(
    list_id: str,
    data: ItemCreate | ItemBatchCreate,
    db: Session = Depends(get_db),
):
    """Create one or more items."""
    # Verify list exists
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    # Handle single item or batch
    if isinstance(data, ItemBatchCreate):
        items = item_service.create_items_batch(db, list_id, data.items)
    else:
        items = [item_service.create_item(db, list_id, data)]

    return items


@router.put("/items/{item_id}", response_model=ItemResponse)
def update_item(item_id: str, data: ItemUpdate, db: Session = Depends(get_db)):
    """Update an item."""
    item = item_service.get_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    updated = item_service.update_item(db, item, data)
    return updated


@router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: str, db: Session = Depends(get_db)):
    """Delete an item."""
    item = item_service.get_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item_service.delete_item(db, item)


@router.post("/items/{item_id}/check", response_model=ItemResponse)
def check_item(
    item_id: str,
    data: ItemCheckRequest | None = None,
    db: Session = Depends(get_db),
):
    """Mark an item as checked."""
    item = item_service.get_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    user_id = data.user_id if data else None
    checked = item_service.check_item(db, item, user_id=user_id)
    return checked


@router.post("/items/{item_id}/uncheck", response_model=ItemResponse)
def uncheck_item(item_id: str, db: Session = Depends(get_db)):
    """Mark an item as unchecked."""
    item = item_service.get_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    unchecked = item_service.uncheck_item(db, item)
    return unchecked


@router.post("/lists/{list_id}/clear", status_code=200)
def clear_checked_items(list_id: str, db: Session = Depends(get_db)):
    """Clear all checked items from a list."""
    # Verify list exists
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    count = item_service.clear_checked_items(db, list_id)
    return {"deleted_count": count}
