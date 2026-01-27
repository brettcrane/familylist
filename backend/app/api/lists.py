"""List API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import verify_api_key
from app.database import get_db
from app.schemas import (
    ListCreate,
    ListDuplicateRequest,
    ListResponse,
    ListUpdate,
    ListWithItemsResponse,
)
from app.services import list_service

router = APIRouter(prefix="/lists", tags=["lists"], dependencies=[Depends(verify_api_key)])


@router.get("", response_model=list[ListResponse])
def get_lists(
    include_templates: bool = Query(False, description="Include template lists"),
    db: Session = Depends(get_db),
):
    """Get all lists."""
    lists = list_service.get_all_lists(db, include_templates=include_templates)
    return lists


@router.post("", response_model=ListWithItemsResponse, status_code=201)
def create_list(data: ListCreate, db: Session = Depends(get_db)):
    """Create a new list with default categories."""
    new_list = list_service.create_list(db, data)
    return new_list


@router.get("/{list_id}", response_model=ListWithItemsResponse)
def get_list(list_id: str, db: Session = Depends(get_db)):
    """Get a list with its categories and items."""
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")
    return list_obj


@router.put("/{list_id}", response_model=ListResponse)
def update_list(list_id: str, data: ListUpdate, db: Session = Depends(get_db)):
    """Update a list."""
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    updated = list_service.update_list(db, list_obj, data)
    return updated


@router.delete("/{list_id}", status_code=204)
def delete_list(list_id: str, db: Session = Depends(get_db)):
    """Delete a list and all its items."""
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    list_service.delete_list(db, list_obj)


@router.post("/{list_id}/duplicate", response_model=ListWithItemsResponse, status_code=201)
def duplicate_list(list_id: str, data: ListDuplicateRequest, db: Session = Depends(get_db)):
    """Duplicate a list, optionally as a template."""
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    new_list = list_service.duplicate_list(
        db, list_obj, new_name=data.name, as_template=data.as_template
    )
    return new_list
