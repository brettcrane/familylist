"""Category API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import verify_api_key
from app.database import get_db
from app.schemas import (
    CategoryCreate,
    CategoryReorder,
    CategoryResponse,
    CategoryUpdate,
)
from app.services import category_service, list_service

router = APIRouter(tags=["categories"], dependencies=[Depends(verify_api_key)])


@router.get("/lists/{list_id}/categories", response_model=list[CategoryResponse])
def get_categories(list_id: str, db: Session = Depends(get_db)):
    """Get all categories for a list."""
    # Verify list exists
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    categories = category_service.get_categories_by_list(db, list_id)
    return categories


@router.post("/lists/{list_id}/categories", response_model=CategoryResponse, status_code=201)
def create_category(list_id: str, data: CategoryCreate, db: Session = Depends(get_db)):
    """Create a new category for a list."""
    # Verify list exists
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    # Check for duplicate name
    existing = category_service.get_category_by_name(db, list_id, data.name)
    if existing:
        raise HTTPException(status_code=409, detail="Category with this name already exists")

    category = category_service.create_category(db, list_id, data)
    return category


@router.put("/categories/{category_id}", response_model=CategoryResponse)
def update_category(category_id: str, data: CategoryUpdate, db: Session = Depends(get_db)):
    """Update a category."""
    category = category_service.get_category_by_id(db, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Check for duplicate name if name is being changed
    if data.name and data.name != category.name:
        existing = category_service.get_category_by_name(db, category.list_id, data.name)
        if existing:
            raise HTTPException(status_code=409, detail="Category with this name already exists")

    updated = category_service.update_category(db, category, data)
    return updated


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(category_id: str, db: Session = Depends(get_db)):
    """Delete a category."""
    category = category_service.get_category_by_id(db, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    category_service.delete_category(db, category)


@router.post("/lists/{list_id}/categories/reorder", response_model=list[CategoryResponse])
def reorder_categories(list_id: str, data: CategoryReorder, db: Session = Depends(get_db)):
    """Reorder categories for a list."""
    # Verify list exists
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    categories = category_service.reorder_categories(db, list_id, data.category_ids)
    return categories
