"""SQLAlchemy ORM models."""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    pass


# Well-known user ID for the Claude AI system user. Seeded by _run_migrations()
# in database.py. Items created via Cowork MCP use this as created_by.
# IMPORTANT: Must match CLAUDE_SYSTEM_USER_ID in frontend/src/types/api.ts.
CLAUDE_SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001"


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
    checked_items = relationship("Item", foreign_keys="[Item.checked_by]", back_populates="checked_by_user")
    assigned_items = relationship("Item", foreign_keys="[Item.assigned_to]", back_populates="assigned_to_user")
    created_items = relationship("Item", foreign_keys="[Item.created_by]", back_populates="created_by_user")
    shared_lists = relationship("ListShare", back_populates="user")
    push_subscriptions = relationship(
        "PushSubscription", back_populates="user", cascade="all, delete-orphan"
    )
    notification_preferences = relationship(
        "NotificationPreferences", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


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
    quantity: Mapped[float] = mapped_column(Float, default=1)
    unit: Mapped[str | None] = mapped_column(String(10))
    notes: Mapped[str | None] = mapped_column(Text)
    is_checked: Mapped[bool] = mapped_column(Boolean, default=False)
    checked_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    checked_at: Mapped[str | None] = mapped_column(Text)
    magnitude: Mapped[str | None] = mapped_column(String(1))
    assigned_to: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    priority: Mapped[str | None] = mapped_column(String(6))
    due_date: Mapped[str | None] = mapped_column(String(10))
    status: Mapped[str | None] = mapped_column(String(11))
    created_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[str] = mapped_column(Text, default=utc_now)
    updated_at: Mapped[str] = mapped_column(Text, default=utc_now, onupdate=utc_now)

    # Relationships
    list = relationship("List", back_populates="items")
    category = relationship("Category", back_populates="items")
    checked_by_user = relationship("User", foreign_keys=[checked_by], back_populates="checked_items")
    assigned_to_user = relationship("User", foreign_keys=[assigned_to], back_populates="assigned_items")
    created_by_user = relationship("User", foreign_keys=[created_by], back_populates="created_items")

    __table_args__ = (
        Index("idx_items_list_id", "list_id"),
        CheckConstraint(
            "magnitude IS NULL OR magnitude IN ('S', 'M', 'L')",
            name="ck_item_magnitude",
        ),
        CheckConstraint(
            "priority IS NULL OR priority IN ('urgent', 'high', 'medium', 'low')",
            name="ck_item_priority",
        ),
        CheckConstraint(
            "status IS NULL OR status IN ('open', 'in_progress', 'done', 'blocked')",
            name="ck_item_status",
        ),
        CheckConstraint(
            "unit IS NULL OR unit IN ('each', 'dozen', 'tsp', 'tbsp', 'fl oz', 'cup', 'pint', 'quart', 'gallon', 'ml', 'L', 'oz', 'lb', 'g', 'kg', 'can', 'bottle', 'jar', 'bag', 'box', 'pkg', 'bunch', 'clove', 'pinch')",
            name="ck_item_unit",
        ),
    )


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


class PushSubscription(Base):
    """Web Push subscription for a user's device."""

    __tablename__ = "push_subscriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    p256dh_key: Mapped[str] = mapped_column(Text, nullable=False)
    auth_key: Mapped[str] = mapped_column(Text, nullable=False)
    user_agent: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(Text, default=utc_now)
    last_used_at: Mapped[str | None] = mapped_column(Text)

    # Relationships
    user = relationship("User", back_populates="push_subscriptions")

    __table_args__ = (
        UniqueConstraint("user_id", "endpoint", name="uq_push_sub_user_endpoint"),
        Index("idx_push_subscriptions_user_id", "user_id"),
    )


class NotificationPreferences(Base):
    """User notification preferences."""

    __tablename__ = "notification_preferences"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    list_updates: Mapped[str] = mapped_column(
        String(20), nullable=False, default="batched"
    )  # "always", "batched", "off"
    list_sharing: Mapped[str] = mapped_column(
        String(20), nullable=False, default="always"
    )  # "always", "off"
    quiet_start: Mapped[str | None] = mapped_column(String(5))  # "22:00"
    quiet_end: Mapped[str | None] = mapped_column(String(5))  # "07:00"

    # Relationships
    user = relationship("User", back_populates="notification_preferences")

    __table_args__ = (
        CheckConstraint(
            "list_updates IN ('always', 'batched', 'off')",
            name="ck_notif_pref_list_updates",
        ),
        CheckConstraint(
            "list_sharing IN ('always', 'off')",
            name="ck_notif_pref_list_sharing",
        ),
    )
