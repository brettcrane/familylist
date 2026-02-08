"""Item service - business logic for item operations."""

from sqlalchemy.orm import Session, joinedload

from app.models import Item, utc_now
from app.schemas import ItemCreate, ItemStatus, ItemUpdate


def get_items_by_list(
    db: Session,
    list_id: str,
    is_checked: str = "all",
    status: list[str] | None = None,
    priority: list[str] | None = None,
    due_before: str | None = None,
    due_after: str | None = None,
    assigned_to: str | None = None,
    created_by: str | None = None,
) -> list[Item]:
    """Get items for a list with optional filters."""
    query = db.query(Item).options(
        joinedload(Item.checked_by_user),
        joinedload(Item.assigned_to_user),
        joinedload(Item.created_by_user),
    ).filter(Item.list_id == list_id)

    if is_checked == "checked":
        query = query.filter(Item.is_checked == True)  # noqa: E712
    elif is_checked == "unchecked":
        query = query.filter(Item.is_checked == False)  # noqa: E712

    if status:
        query = query.filter(Item.status.in_(status))
    if priority:
        query = query.filter(Item.priority.in_(priority))
    if due_before:
        query = query.filter(Item.due_date <= due_before)
    if due_after:
        query = query.filter(Item.due_date >= due_after)
    if assigned_to:
        query = query.filter(Item.assigned_to == assigned_to)
    if created_by:
        query = query.filter(Item.created_by == created_by)

    # Sort: unchecked items by sort_order, checked items by checked_at desc
    return query.order_by(Item.is_checked, Item.sort_order).all()


def get_item_by_id(db: Session, item_id: str) -> Item | None:
    """Get an item by ID."""
    return db.query(Item).options(
        joinedload(Item.checked_by_user),
        joinedload(Item.assigned_to_user),
        joinedload(Item.created_by_user),
    ).filter(Item.id == item_id).first()


def create_item(
    db: Session, list_id: str, data: ItemCreate, created_by: str | None = None
) -> Item:
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
        magnitude=data.magnitude,
        assigned_to=data.assigned_to,
        priority=data.priority,
        due_date=data.due_date,
        status=data.status,
        created_by=created_by,
        sort_order=next_order,
    )
    # Sync: status=done at create time → mark checked
    if data.status == ItemStatus.DONE:
        item.is_checked = True
        item.checked_at = utc_now()
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def create_items_batch(
    db: Session, list_id: str, items_data: list[ItemCreate], created_by: str | None = None
) -> list[Item]:
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
            magnitude=data.magnitude,
            assigned_to=data.assigned_to,
            priority=data.priority,
            due_date=data.due_date,
            status=data.status,
            created_by=created_by,
            sort_order=next_order + idx,
        )
        # Sync: status=done at create time → mark checked
        if data.status == ItemStatus.DONE:
            item.is_checked = True
            item.checked_at = utc_now()
        db.add(item)
        items.append(item)

    db.commit()
    for item in items:
        db.refresh(item)
    return items


def update_item(db: Session, item: Item, data: ItemUpdate) -> Item:
    """Update an item.

    Bidirectional sync between status and is_checked for task items:
    - Setting status=done → is_checked=True
    - Setting status to open/in_progress/blocked → is_checked=False
    """
    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(item, field, value)

    # Bidirectional sync between status and is_checked for task items
    if "status" in update_data:
        if update_data["status"] == ItemStatus.DONE.value:
            item.is_checked = True
            item.checked_at = utc_now()
        elif update_data["status"] in (
            ItemStatus.OPEN.value,
            ItemStatus.IN_PROGRESS.value,
            ItemStatus.BLOCKED.value,
        ):
            item.is_checked = False
            item.checked_at = None
            item.checked_by = None

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
    # Sync status for task items
    if item.status is not None:
        item.status = ItemStatus.DONE.value
    item.updated_at = utc_now()
    db.commit()
    db.refresh(item)
    return item


def uncheck_item(db: Session, item: Item) -> Item:
    """Mark an item as unchecked."""
    item.is_checked = False
    item.checked_at = None
    item.checked_by = None
    # Sync status for task items
    if item.status is not None:
        item.status = ItemStatus.OPEN.value
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
        # Sync status for task items
        if item.status is not None:
            item.status = ItemStatus.OPEN.value
        item.updated_at = utc_now()

    db.commit()
    return count
