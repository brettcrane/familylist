"""Category service - business logic for category operations."""

from sqlalchemy.orm import Session

from app.models import Category
from app.schemas import CategoryCreate, CategoryUpdate


def get_categories_by_list(db: Session, list_id: str) -> list[Category]:
    """Get all categories for a list, ordered by sort_order."""
    return (
        db.query(Category)
        .filter(Category.list_id == list_id)
        .order_by(Category.sort_order)
        .all()
    )


def get_category_by_id(db: Session, category_id: str) -> Category | None:
    """Get a category by ID."""
    return db.query(Category).filter(Category.id == category_id).first()


def get_category_by_name(db: Session, list_id: str, name: str) -> Category | None:
    """Get a category by name within a list."""
    return (
        db.query(Category)
        .filter(Category.list_id == list_id, Category.name == name)
        .first()
    )


def create_category(db: Session, list_id: str, data: CategoryCreate) -> Category:
    """Create a new category."""
    # Get max sort_order if not provided
    if data.sort_order is None:
        max_order = (
            db.query(Category.sort_order)
            .filter(Category.list_id == list_id)
            .order_by(Category.sort_order.desc())
            .first()
        )
        sort_order = (max_order[0] + 1) if max_order else 0
    else:
        sort_order = data.sort_order

    category = Category(
        list_id=list_id,
        name=data.name,
        sort_order=sort_order,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def update_category(db: Session, category: Category, data: CategoryUpdate) -> Category:
    """Update a category."""
    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(category, field, value)

    db.commit()
    db.refresh(category)
    return category


def delete_category(db: Session, category: Category) -> None:
    """Delete a category (items will have category_id set to NULL)."""
    db.delete(category)
    db.commit()


def reorder_categories(db: Session, list_id: str, category_ids: list[str]) -> list[Category]:
    """Reorder categories by updating their sort_order."""
    categories = []
    for idx, cat_id in enumerate(category_ids):
        category = db.query(Category).filter(
            Category.id == cat_id, Category.list_id == list_id
        ).first()
        if category:
            category.sort_order = idx
            categories.append(category)

    db.commit()
    for cat in categories:
        db.refresh(cat)

    return sorted(categories, key=lambda c: c.sort_order)
