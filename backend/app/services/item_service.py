"""Item service - business logic for item operations."""

from sqlalchemy.orm import Session, joinedload

from app.models import Item, utc_now
from app.schemas import ItemCreate, ItemUpdate


def get_items_by_list(
    db: Session, list_id: str, status: str = "all"
) -> list[Item]:
    """Get items for a list, filtered by status."""
    query = db.query(Item).options(joinedload(Item.checked_by_user)).filter(Item.list_id == list_id)

    if status == "checked":
        query = query.filter(Item.is_checked == True)  # noqa: E712
    elif status == "unchecked":
        query = query.filter(Item.is_checked == False)  # noqa: E712

    # Sort: unchecked items by sort_order, checked items by checked_at desc
    return query.order_by(Item.is_checked, Item.sort_order).all()


def get_item_by_id(db: Session, item_id: str) -> Item | None:
    """Get an item by ID."""
    return db.query(Item).options(joinedload(Item.checked_by_user)).filter(Item.id == item_id).first()


def create_item(db: Session, list_id: str, data: ItemCreate) -> Item:
    """Create a new item."""
    # Get max sort_order for this list
    max_order = (
        db.query(Item.sort_order)
        .filter(Item.list_id == list_id)
        .order_by(Item.sort_order.desc())
        .first()
    )
    next_order = (max_order[0] + 1) if max_order else 0

    item = Item(
        list_id=list_id,
        name=data.name,
        quantity=data.quantity,
        notes=data.notes,
        category_id=data.category_id,
        sort_order=next_order,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def create_items_batch(db: Session, list_id: str, items_data: list[ItemCreate]) -> list[Item]:
    """Create multiple items at once."""
    # Get max sort_order for this list
    max_order = (
        db.query(Item.sort_order)
        .filter(Item.list_id == list_id)
        .order_by(Item.sort_order.desc())
        .first()
    )
    next_order = (max_order[0] + 1) if max_order else 0

    items = []
    for idx, data in enumerate(items_data):
        item = Item(
            list_id=list_id,
            name=data.name,
            quantity=data.quantity,
            notes=data.notes,
            category_id=data.category_id,
            sort_order=next_order + idx,
        )
        db.add(item)
        items.append(item)

    db.commit()
    for item in items:
        db.refresh(item)
    return items


def update_item(db: Session, item: Item, data: ItemUpdate) -> Item:
    """Update an item."""
    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(item, field, value)

    item.updated_at = utc_now()
    db.commit()
    db.refresh(item)
    return item


def delete_item(db: Session, item: Item) -> None:
    """Delete an item."""
    db.delete(item)
    db.commit()


def check_item(db: Session, item: Item, user_id: str | None = None) -> Item:
    """Mark an item as checked."""
    item.is_checked = True
    item.checked_at = utc_now()
    item.checked_by = user_id
    item.updated_at = utc_now()
    db.commit()
    db.refresh(item)
    return item


def uncheck_item(db: Session, item: Item) -> Item:
    """Mark an item as unchecked."""
    item.is_checked = False
    item.checked_at = None
    item.checked_by = None
    item.updated_at = utc_now()
    db.commit()
    db.refresh(item)
    return item


def clear_checked_items(db: Session, list_id: str) -> int:
    """Delete all checked items from a list. Returns count of deleted items."""
    count = (
        db.query(Item)
        .filter(Item.list_id == list_id, Item.is_checked == True)  # noqa: E712
        .delete()
    )
    db.commit()
    return count


def restore_checked_items(db: Session, list_id: str) -> int:
    """Restore (uncheck) all checked items in a list. Returns count of restored items."""
    items = (
        db.query(Item)
        .filter(Item.list_id == list_id, Item.is_checked == True)  # noqa: E712
        .all()
    )

    count = len(items)
    for item in items:
        item.is_checked = False
        item.checked_at = None
        item.checked_by = None
        item.updated_at = utc_now()

    db.commit()
    return count
