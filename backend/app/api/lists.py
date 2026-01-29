"""List API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import AuthResult, get_auth
from app.database import get_db
from app.dependencies import check_list_access, get_current_user
from app.models import User
from app.schemas import (
    ListCreate,
    ListDuplicateRequest,
    ListResponse,
    ListUpdate,
    ListWithItemsResponse,
)
from app.services import list_service

router = APIRouter(prefix="/lists", tags=["lists"], dependencies=[Depends(get_auth)])


@router.get("", response_model=list[ListResponse])
def get_lists(
    include_templates: bool = Query(False, description="Include template lists"),
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get lists with item counts.

    When using Clerk auth: returns lists owned by or shared with the user.
    When using API key auth: returns all lists (backward compatible).
    """
    if current_user:
        # User is Clerk-authenticated - return their lists
        lists = list_service.get_lists_for_user(
            db, current_user.id, include_templates=include_templates
        )
    else:
        # API key auth - return all lists (backward compatible)
        lists = list_service.get_all_lists(db, include_templates=include_templates)

    # Add item counts to each list
    result = []
    for lst in lists:
        stats = list_service.get_list_stats(db, lst.id)
        result.append(
            ListResponse(
                id=lst.id,
                name=lst.name,
                type=lst.type,
                icon=lst.icon,
                color=lst.color,
                owner_id=lst.owner_id,
                is_template=lst.is_template,
                created_at=lst.created_at or "",
                updated_at=lst.updated_at or "",
                item_count=stats["total_items"],
                checked_count=stats["checked_items"],
            )
        )
    return result


@router.post("", response_model=ListWithItemsResponse, status_code=201)
def create_list(
    data: ListCreate,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new list with default categories.

    When using Clerk auth: sets owner_id to the current user.
    When using API key auth: uses owner_id from request body if provided.
    """
    # Set owner_id from current user if Clerk-authenticated
    if current_user and not data.owner_id:
        data.owner_id = current_user.id

    new_list = list_service.create_list(db, data)
    return new_list


@router.get("/{list_id}", response_model=ListWithItemsResponse)
def get_list(
    list_id: str,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a list with its categories and items."""
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    # Check access permission
    check_list_access(db, list_id, current_user, require_edit=False)

    return list_obj


@router.put("/{list_id}", response_model=ListResponse)
def update_list(
    list_id: str,
    data: ListUpdate,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a list."""
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    # Check edit permission
    check_list_access(db, list_id, current_user, require_edit=True)

    updated = list_service.update_list(db, list_obj, data)
    return updated


@router.delete("/{list_id}", status_code=204)
def delete_list(
    list_id: str,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a list and all its items."""
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    # Check edit permission (delete requires edit access)
    check_list_access(db, list_id, current_user, require_edit=True)

    list_service.delete_list(db, list_obj)


@router.post("/{list_id}/duplicate", response_model=ListWithItemsResponse, status_code=201)
def duplicate_list(
    list_id: str,
    data: ListDuplicateRequest,
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Duplicate a list, optionally as a template."""
    list_obj = list_service.get_list_by_id(db, list_id)
    if not list_obj:
        raise HTTPException(status_code=404, detail="List not found")

    # Check view permission (need to see list to duplicate it)
    check_list_access(db, list_id, current_user, require_edit=False)

    # Set owner of new list to current user if Clerk-authenticated
    owner_id = current_user.id if current_user else list_obj.owner_id

    new_list = list_service.duplicate_list(
        db, list_obj, new_name=data.name, as_template=data.as_template, owner_id=owner_id
    )
    return new_list
