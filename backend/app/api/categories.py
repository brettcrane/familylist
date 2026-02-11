"""Category API endpoints."""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_auth
from app.database import get_db
from app.dependencies import check_list_access, get_current_user
from app.models import User
from app.schemas import (
    CategoryCreate,
    CategoryReorder,
    CategoryResponse,
    CategoryUpdate,
)
from app.services import category_service, list_service

router = APIRouter(tags=["categories"], dependencies=[Depends(get_auth)])


@router.get("/lists/{list_id}/categories", response_model=list[CategoryResponse], operation_id="get_categories")
def get_categories(
    list_id: str,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all categories for a list."""
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    check_list_access(db, list_id, current_user, require_edit=False)

    categories = category_service.get_categories_by_list(db, list_id)
    return categories


@router.post("/lists/{list_id}/categories", response_model=CategoryResponse, status_code=201, operation_id="create_category")
def create_category(
    list_id: str,
    data: CategoryCreate,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new category for a list."""
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    check_list_access(db, list_id, current_user, require_edit=True)

    # Check for duplicate name
    existing = category_service.get_category_by_name(db, list_id, data.name)
    if existing:
        raise HTTPException(status_code=409, detail="Category with this name already exists")

    category = category_service.create_category(db, list_id, data)
    return category


@router.put("/categories/{category_id}", response_model=CategoryResponse, operation_id="update_category")
def update_category(
    category_id: str,
    data: CategoryUpdate,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a category."""
    category = category_service.get_category_by_id(db, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    check_list_access(db, category.list_id, current_user, require_edit=True)

    # Check for duplicate name if name is being changed
    if data.name and data.name != category.name:
        existing = category_service.get_category_by_name(db, category.list_id, data.name)
        if existing:
            raise HTTPException(status_code=409, detail="Category with this name already exists")

    updated = category_service.update_category(db, category, data)
    return updated


@router.delete("/categories/{category_id}", status_code=204, operation_id="delete_category")
def delete_category(
    category_id: str,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a category."""
    category = category_service.get_category_by_id(db, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    check_list_access(db, category.list_id, current_user, require_edit=True)

    category_service.delete_category(db, category)


@router.post("/lists/{list_id}/categories/reorder", response_model=list[CategoryResponse], operation_id="reorder_categories")
def reorder_categories(
    list_id: str,
    data: CategoryReorder,
    background_tasks: BackgroundTasks,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reorder categories for a list."""
    from app.api.items import get_notification_recipients, publish_event_async
    from app.services.event_broadcaster import ListEvent

    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    check_list_access(db, list_id, current_user, require_edit=True)

    categories = category_service.reorder_categories(db, list_id, data.category_ids)

    recipient_ids = get_notification_recipients(db, list_id)
    background_tasks.add_task(
        publish_event_async,
        ListEvent(
            event_type="categories_reordered",
            list_id=list_id,
            user_id=current_user.id if current_user else None,
            user_name=current_user.display_name if current_user else None,
        ),
        list_obj.name,
        recipient_ids,
    )

    return categories
