"""List service - business logic for list operations."""

from sqlalchemy.orm import Session

from app.models import Category, Item, List, utc_now
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
        "High Priority",
        "Normal",
        "Low Priority",
    ],
}


def get_all_lists(db: Session, include_templates: bool = False) -> list[List]:
    """Get all lists, optionally including templates."""
    query = db.query(List)
    if not include_templates:
        query = query.filter(List.is_template == False)  # noqa: E712
    return query.order_by(List.created_at.desc()).all()


def get_list_by_id(db: Session, list_id: str) -> List | None:
    """Get a list by ID."""
    return db.query(List).filter(List.id == list_id).first()


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
    db: Session, source_list: List, new_name: str, as_template: bool = False
) -> List:
    """Duplicate a list with all its categories and optionally items."""
    # Create new list
    new_list = List(
        name=new_name,
        type=source_list.type,
        icon=source_list.icon,
        color=source_list.color,
        owner_id=source_list.owner_id,
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
