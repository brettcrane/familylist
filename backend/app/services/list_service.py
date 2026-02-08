"""List service - business logic for list operations."""

from sqlalchemy.orm import Session, joinedload

from app.models import Category, Item, List, ListShare, utc_now
from app.schemas import ListCreate, ListType, ListUpdate

# Default categories per list type
DEFAULT_CATEGORIES: dict[str, list[str]] = {
    ListType.GROCERY: [
        "Produce",
        "Dairy",
        "Meat & Seafood",
        "Bakery",
        "Frozen",
        "Pantry",
        "Beverages",
        "Snacks",
        "Household",
        "Personal Care",
        "Other",
    ],
    ListType.PACKING: [
        "Clothing",
        "Toiletries",
        "Electronics",
        "Documents",
        "Accessories",
        "Other",
    ],
    ListType.TASKS: [
        "Health",
        "Home",
        "Finance",
        "Family",
        "Work",
    ],
}


def get_all_lists(db: Session, include_templates: bool = False) -> list[List]:
    """Get all lists, optionally including templates."""
    query = db.query(List).options(joinedload(List.owner))
    if not include_templates:
        query = query.filter(List.is_template == False)  # noqa: E712
    return query.order_by(List.created_at.desc()).all()


def get_lists_for_user(
    db: Session, user_id: str, include_templates: bool = False
) -> list[List]:
    """Get lists owned by or shared with a user.

    Args:
        db: Database session
        user_id: The user's internal ID
        include_templates: Whether to include template lists

    Returns:
        List of lists the user has access to (owned + shared)
    """
    # Get lists owned by the user
    owned_query = db.query(List).options(joinedload(List.owner)).filter(List.owner_id == user_id)
    if not include_templates:
        owned_query = owned_query.filter(List.is_template == False)  # noqa: E712

    # Get lists shared with the user
    shared_list_ids = (
        db.query(ListShare.list_id).filter(ListShare.user_id == user_id).subquery()
    )
    shared_query = db.query(List).options(joinedload(List.owner)).filter(List.id.in_(shared_list_ids))
    if not include_templates:
        shared_query = shared_query.filter(List.is_template == False)  # noqa: E712

    # Combine and deduplicate
    owned_lists = owned_query.all()
    shared_lists = shared_query.all()

    # Merge lists, avoiding duplicates
    seen_ids = set()
    result = []
    for lst in owned_lists + shared_lists:
        if lst.id not in seen_ids:
            seen_ids.add(lst.id)
            result.append(lst)

    # Sort by created_at descending
    result.sort(key=lambda x: x.created_at or "", reverse=True)
    return result


def user_can_access_list(db: Session, user_id: str, list_id: str) -> bool:
    """Check if a user can access a list (owns it or has share permission)."""
    lst = get_list_by_id(db, list_id)
    if not lst:
        return False

    # Owner can access
    if lst.owner_id == user_id:
        return True

    # Check for share permission
    share = (
        db.query(ListShare)
        .filter(ListShare.list_id == list_id, ListShare.user_id == user_id)
        .first()
    )
    return share is not None


def user_can_edit_list(db: Session, user_id: str, list_id: str) -> bool:
    """Check if a user can edit a list (owns it or has edit/admin permission)."""
    lst = get_list_by_id(db, list_id)
    if not lst:
        return False

    # Owner can edit
    if lst.owner_id == user_id:
        return True

    # Check for edit/admin share permission
    share = (
        db.query(ListShare)
        .filter(
            ListShare.list_id == list_id,
            ListShare.user_id == user_id,
            ListShare.permission == "edit",
        )
        .first()
    )
    return share is not None


def get_list_by_id(db: Session, list_id: str) -> List | None:
    """Get a list by ID."""
    return db.query(List).filter(List.id == list_id).first()


def get_list_with_items(db: Session, list_id: str) -> List | None:
    """Get a list by ID with owner, categories, and items eagerly loaded.

    Items include checked_by_user and assigned_to_user relationships.
    This avoids N+1 queries when serializing items with user names.
    """
    return (
        db.query(List)
        .options(
            joinedload(List.owner),
            joinedload(List.categories),
            joinedload(List.items).joinedload(Item.checked_by_user),
            joinedload(List.items).joinedload(Item.assigned_to_user),
            joinedload(List.items).joinedload(Item.created_by_user),
        )
        .filter(List.id == list_id)
        .first()
    )


def create_list(db: Session, data: ListCreate) -> List:
    """Create a new list with default categories."""
    # Create the list
    new_list = List(
        name=data.name,
        type=data.type.value,
        icon=data.icon,
        color=data.color,
        owner_id=data.owner_id,
    )
    db.add(new_list)
    db.flush()  # Get the ID

    # Create default categories for this list type
    default_cats = DEFAULT_CATEGORIES.get(data.type, [])
    for idx, cat_name in enumerate(default_cats):
        category = Category(
            list_id=new_list.id,
            name=cat_name,
            sort_order=idx,
        )
        db.add(category)

    db.commit()
    db.refresh(new_list)
    return new_list


def update_list(db: Session, list_obj: List, data: ListUpdate) -> List:
    """Update a list."""
    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(list_obj, field, value)

    list_obj.updated_at = utc_now()
    db.commit()
    db.refresh(list_obj)
    return list_obj


def delete_list(db: Session, list_obj: List) -> None:
    """Delete a list (cascades to categories and items)."""
    db.delete(list_obj)
    db.commit()


def duplicate_list(
    db: Session,
    source_list: List,
    new_name: str,
    as_template: bool = False,
    owner_id: str | None = None,
) -> List:
    """Duplicate a list with all its categories and optionally items.

    Args:
        db: Database session
        source_list: The list to duplicate
        new_name: Name for the new list
        as_template: Whether to create as a template
        owner_id: Owner ID for the new list (defaults to source list owner)
    """
    # Create new list
    new_list = List(
        name=new_name,
        type=source_list.type,
        icon=source_list.icon,
        color=source_list.color,
        owner_id=owner_id if owner_id is not None else source_list.owner_id,
        is_template=as_template,
    )
    db.add(new_list)
    db.flush()

    # Map old category IDs to new categories
    category_map: dict[str, str] = {}

    # Duplicate categories
    for cat in source_list.categories:
        new_cat = Category(
            list_id=new_list.id,
            name=cat.name,
            sort_order=cat.sort_order,
        )
        db.add(new_cat)
        db.flush()
        category_map[cat.id] = new_cat.id

    # Duplicate items (only unchecked items, reset state)
    for item in source_list.items:
        if not item.is_checked:
            new_item = Item(
                list_id=new_list.id,
                category_id=category_map.get(item.category_id) if item.category_id else None,
                name=item.name,
                quantity=item.quantity,
                notes=item.notes,
                magnitude=item.magnitude,
                priority=item.priority,
                due_date=item.due_date,
                status=item.status,
                sort_order=item.sort_order,
            )
            db.add(new_item)

    db.commit()
    db.refresh(new_list)
    return new_list


def get_list_stats(db: Session, list_id: str) -> dict:
    """Get statistics for a list."""
    total = db.query(Item).filter(Item.list_id == list_id).count()
    checked = (
        db.query(Item).filter(Item.list_id == list_id, Item.is_checked == True).count()  # noqa: E712
    )
    return {
        "total_items": total,
        "checked_items": checked,
        "unchecked_items": total - checked,
    }


def get_list_shares(db: Session, list_id: str) -> list[ListShare]:
    """Get all shares for a list with user details eagerly loaded."""
    return (
        db.query(ListShare)
        .filter(ListShare.list_id == list_id)
        .all()
    )


def get_list_share_count(db: Session, list_id: str) -> int:
    """Get the count of shares for a list."""
    return db.query(ListShare).filter(ListShare.list_id == list_id).count()


def get_share_by_id(db: Session, share_id: str) -> ListShare | None:
    """Get a share by ID."""
    return db.query(ListShare).filter(ListShare.id == share_id).first()


def create_list_share(
    db: Session, list_id: str, user_id: str, permission: str
) -> ListShare:
    """Create a new list share."""
    share = ListShare(
        list_id=list_id,
        user_id=user_id,
        permission=permission,
    )
    db.add(share)
    db.commit()
    db.refresh(share)
    return share


def update_list_share(
    db: Session, share: ListShare, permission: str
) -> ListShare:
    """Update a list share's permission."""
    share.permission = permission
    db.commit()
    db.refresh(share)
    return share


def delete_list_share(db: Session, share: ListShare) -> None:
    """Delete a list share."""
    db.delete(share)
    db.commit()


def get_existing_share(db: Session, list_id: str, user_id: str) -> ListShare | None:
    """Check if a share already exists for this list and user."""
    return (
        db.query(ListShare)
        .filter(ListShare.list_id == list_id, ListShare.user_id == user_id)
        .first()
    )


def is_list_owner(db: Session, list_id: str, user_id: str) -> bool:
    """Check if a user is the owner of a list."""
    lst = get_list_by_id(db, list_id)
    return lst is not None and lst.owner_id == user_id
