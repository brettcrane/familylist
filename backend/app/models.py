"""SQLAlchemy ORM models."""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    pass


def generate_uuid() -> str:
    """Generate a new UUID as string."""
    return str(uuid.uuid4())


def utc_now() -> str:
    """Get current UTC timestamp as ISO string."""
    return datetime.now(timezone.utc).isoformat()


class User(Base):
    """User model (synced from Clerk authentication)."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    clerk_user_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(Text, default=utc_now)
    updated_at: Mapped[str] = mapped_column(Text, default=utc_now, onupdate=utc_now)

    # Relationships
    owned_lists = relationship("List", back_populates="owner")
    checked_items = relationship("Item", back_populates="checked_by_user")
    shared_lists = relationship("ListShare", back_populates="user")


class ListShare(Base):
    """Sharing permissions for lists between users."""

    __tablename__ = "list_shares"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    list_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("lists.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    permission: Mapped[str] = mapped_column(
        String(20), nullable=False, default="view"
    )  # "view" | "edit"
    created_at: Mapped[str] = mapped_column(Text, default=utc_now)

    # Relationships
    list = relationship("List", back_populates="shares")
    user = relationship("User", back_populates="shared_lists")

    __table_args__ = (
        UniqueConstraint("list_id", "user_id", name="uq_list_share_list_user"),
        CheckConstraint(
            "permission IN ('view', 'edit')",
            name="ck_list_share_permission",
        ),
        Index("idx_list_shares_user_id", "user_id"),
    )


class List(Base):
    """List model for grocery, packing, or task lists."""

    __tablename__ = "lists"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # grocery, packing, tasks
    icon: Mapped[str | None] = mapped_column(String(50))
    color: Mapped[str | None] = mapped_column(String(20))
    owner_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    is_template: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[str] = mapped_column(Text, default=utc_now)
    updated_at: Mapped[str] = mapped_column(Text, default=utc_now, onupdate=utc_now)

    # Relationships
    owner = relationship("User", back_populates="owned_lists")
    categories = relationship(
        "Category", back_populates="list", cascade="all, delete-orphan", order_by="Category.sort_order"
    )
    items = relationship(
        "Item", back_populates="list", cascade="all, delete-orphan", order_by="Item.sort_order"
    )
    shares = relationship(
        "ListShare", back_populates="list", cascade="all, delete-orphan"
    )


class Category(Base):
    """Category model for organizing items within a list."""

    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    list_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("lists.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    list = relationship("List", back_populates="categories")
    items = relationship("Item", back_populates="category")

    __table_args__ = (
        UniqueConstraint("list_id", "name", name="uq_category_list_name"),
        Index("idx_categories_list_id", "list_id"),
    )


class Item(Base):
    """Item model for individual list entries."""

    __tablename__ = "items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    list_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("lists.id", ondelete="CASCADE"), nullable=False
    )
    category_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("categories.id", ondelete="SET NULL")
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    notes: Mapped[str | None] = mapped_column(Text)
    is_checked: Mapped[bool] = mapped_column(Boolean, default=False)
    checked_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    checked_at: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[str] = mapped_column(Text, default=utc_now)
    updated_at: Mapped[str] = mapped_column(Text, default=utc_now, onupdate=utc_now)

    # Relationships
    list = relationship("List", back_populates="items")
    category = relationship("Category", back_populates="items")
    checked_by_user = relationship("User", back_populates="checked_items")

    __table_args__ = (Index("idx_items_list_id", "list_id"),)


class CategoryLearning(Base):
    """AI learning data for category suggestions."""

    __tablename__ = "category_learnings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    item_name_normalized: Mapped[str] = mapped_column(String(255), nullable=False)
    list_type: Mapped[str] = mapped_column(String(20), nullable=False)
    category_name: Mapped[str] = mapped_column(String(255), nullable=False)
    confidence_boost: Mapped[float] = mapped_column(Float, default=0.1)
    created_at: Mapped[str] = mapped_column(Text, default=utc_now)
    updated_at: Mapped[str] = mapped_column(Text, default=utc_now, onupdate=utc_now)

    __table_args__ = (
        UniqueConstraint("item_name_normalized", "list_type", name="uq_learning_item_type"),
        Index("idx_learnings_lookup", "item_name_normalized", "list_type"),
    )
