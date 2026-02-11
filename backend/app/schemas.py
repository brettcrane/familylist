"""Pydantic request/response schemas."""

from enum import Enum

from datetime import date

from pydantic import BaseModel, EmailStr, Field, field_validator


class ListType(str, Enum):
    """Valid list types."""

    GROCERY = "grocery"
    PACKING = "packing"
    TASKS = "tasks"


class Magnitude(str, Enum):
    """Valid magnitude (effort sizing) values."""

    SMALL = "S"
    MEDIUM = "M"
    LARGE = "L"


class Priority(str, Enum):
    """Valid priority levels for task items."""

    URGENT = "urgent"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ItemStatus(str, Enum):
    """Valid status values for task items."""

    OPEN = "open"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    BLOCKED = "blocked"


# ============================================================================
# User Schemas
# ============================================================================


class UserBase(BaseModel):
    """Base user schema."""

    clerk_user_id: str = Field(..., min_length=1, max_length=255)
    display_name: str = Field(..., min_length=1, max_length=255)
    email: str | None = Field(None, max_length=255)
    avatar_url: str | None = Field(None, max_length=2048)


class UserCreate(BaseModel):
    """Schema for creating a user from Clerk data."""

    clerk_user_id: str = Field(..., min_length=1, max_length=255)
    display_name: str = Field(..., min_length=1, max_length=255)
    email: str | None = Field(None, max_length=255)
    avatar_url: str | None = Field(None, max_length=2048)


class UserUpdate(BaseModel):
    """Schema for updating a user."""

    display_name: str | None = Field(None, min_length=1, max_length=255)
    email: str | None = Field(None, max_length=255)
    avatar_url: str | None = Field(None, max_length=2048)


class UserResponse(UserBase):
    """User response schema."""

    id: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


# ============================================================================
# List Share Schemas
# ============================================================================


class ListSharePermission(str, Enum):
    """Valid list share permissions."""

    VIEW = "view"
    EDIT = "edit"


class ListShareCreate(BaseModel):
    """Schema for sharing a list with a user."""

    user_id: str
    permission: ListSharePermission = ListSharePermission.VIEW


class ListShareByEmailRequest(BaseModel):
    """Schema for sharing a list by email."""

    email: EmailStr
    permission: ListSharePermission = ListSharePermission.VIEW


class ListShareUpdate(BaseModel):
    """Schema for updating a list share."""

    permission: ListSharePermission


class ListShareResponse(BaseModel):
    """List share response schema (basic)."""

    id: str
    list_id: str
    user_id: str
    permission: ListSharePermission
    created_at: str

    model_config = {"from_attributes": True}


class ListShareWithUserResponse(BaseModel):
    """List share response schema with user details."""

    id: str
    list_id: str
    user: UserResponse
    permission: ListSharePermission
    created_at: str

    model_config = {"from_attributes": True}


# ============================================================================
# Category Schemas
# ============================================================================


class CategoryBase(BaseModel):
    """Base category schema."""

    name: str = Field(..., min_length=1, max_length=255)


class CategoryCreate(CategoryBase):
    """Schema for creating a category."""

    sort_order: int | None = None


class CategoryUpdate(BaseModel):
    """Schema for updating a category."""

    name: str | None = Field(None, min_length=1, max_length=255)
    sort_order: int | None = None


class CategoryResponse(CategoryBase):
    """Category response schema."""

    id: str
    list_id: str
    sort_order: int

    model_config = {"from_attributes": True}


class CategoryReorder(BaseModel):
    """Schema for reordering categories."""

    category_ids: list[str] = Field(..., description="Ordered list of category IDs")


# ============================================================================
# Item Schemas
# ============================================================================


class ItemReorder(BaseModel):
    """Schema for reordering items within a list."""

    item_ids: list[str] = Field(..., description="Ordered list of item IDs")


class ItemBase(BaseModel):
    """Base item schema."""

    name: str = Field(..., min_length=1, max_length=255)
    quantity: int = Field(default=1, ge=1)
    notes: str | None = None
    category_id: str | None = None
    magnitude: Magnitude | None = None


class _DueDateMixin:
    """Shared due_date validator for create/update schemas."""

    @field_validator("due_date")
    @classmethod
    def validate_due_date(cls, v: str | None) -> str | None:
        if v is None:
            return v
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError(f"Invalid calendar date: {v}")
        return v


class ItemCreate(ItemBase, _DueDateMixin):
    """Schema for creating a single item."""

    assigned_to: str | None = Field(None, min_length=36, max_length=36, description="User ID (UUID) of the person to assign this item to. Must have access to the list.")
    priority: Priority | None = None
    due_date: str | None = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Due date in YYYY-MM-DD format.")
    status: ItemStatus | None = None


class ItemBatchCreate(BaseModel):
    """Schema for batch creating items."""

    items: list[ItemCreate]


class ItemUpdate(BaseModel, _DueDateMixin):
    """Schema for updating an item."""

    name: str | None = Field(None, min_length=1, max_length=255)
    quantity: int | None = Field(None, ge=1)
    notes: str | None = None
    category_id: str | None = None
    magnitude: Magnitude | None = None
    assigned_to: str | None = Field(None, min_length=36, max_length=36, description="User ID (UUID) of the person to assign this item to. Must have access to the list.")
    priority: Priority | None = None
    due_date: str | None = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Due date in YYYY-MM-DD format.")
    status: ItemStatus | None = None
    sort_order: int | None = None


class ItemResponse(ItemBase):
    """Item response schema."""

    id: str
    list_id: str
    is_checked: bool
    checked_by: str | None
    checked_by_name: str | None = None
    checked_at: str | None
    assigned_to: str | None = None
    assigned_to_name: str | None = None
    priority: Priority | None = None
    due_date: str | None = None
    status: ItemStatus | None = None
    created_by: str | None = None
    created_by_name: str | None = None
    sort_order: int
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class ItemCheckRequest(BaseModel):
    """Schema for checking/unchecking an item."""

    user_id: str | None = Field(None, description="User ID who checked the item")


# ============================================================================
# List Schemas
# ============================================================================


class ListBase(BaseModel):
    """Base list schema."""

    name: str = Field(..., min_length=1, max_length=255)
    type: ListType
    icon: str | None = None
    color: str | None = None


class ListCreate(ListBase):
    """Schema for creating a list."""

    owner_id: str | None = None


class ListUpdate(BaseModel):
    """Schema for updating a list."""

    name: str | None = Field(None, min_length=1, max_length=255)
    icon: str | None = None
    color: str | None = None
    owner_id: str | None = Field(None, description="User ID (UUID) of the list owner. Only settable via API key auth.")


class ListResponse(ListBase):
    """List response schema (without items)."""

    id: str
    owner_id: str | None
    owner_name: str | None = None
    is_template: bool
    created_at: str
    updated_at: str
    item_count: int = 0
    checked_count: int = 0
    share_count: int = 0
    is_shared: bool = False

    model_config = {"from_attributes": True}


class ListWithItemsResponse(ListResponse):
    """List response schema with items and categories."""

    categories: list[CategoryResponse] = []
    items: list[ItemResponse] = []


class ListDuplicateRequest(BaseModel):
    """Schema for duplicating a list."""

    name: str = Field(..., min_length=1, max_length=255)
    as_template: bool = False


# ============================================================================
# AI Schemas
# ============================================================================


class CategorizeRequest(BaseModel):
    """Schema for AI categorization request."""

    item_name: str = Field(..., min_length=1, max_length=255)
    list_type: ListType


class CategorizeResponse(BaseModel):
    """Schema for AI categorization response."""

    category: str
    confidence: float = Field(..., ge=0, le=1)


class FeedbackRequest(BaseModel):
    """Schema for AI learning feedback."""

    item_name: str = Field(..., min_length=1, max_length=255)
    list_type: ListType
    correct_category: str = Field(..., min_length=1, max_length=255)


class FeedbackResponse(BaseModel):
    """Schema for AI feedback response."""

    message: str
    item_name_normalized: str


class ParsedItemResponse(BaseModel):
    """Schema for a single parsed item."""

    name: str
    category: str
    quantity: int = 1


class ParseRequest(BaseModel):
    """Schema for natural language parsing request."""

    input: str = Field(..., min_length=1, max_length=500)
    list_type: ListType


class ParseResponse(BaseModel):
    """Schema for natural language parsing response."""

    original_input: str
    items: list[ParsedItemResponse]
    confidence: float = Field(..., ge=0, le=1)


# ============================================================================
# Health Check
# ============================================================================


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = "healthy"
    version: str = "0.1.0"
    environment: str


# ============================================================================
# Error Response
# ============================================================================


class ErrorResponse(BaseModel):
    """Standard error response."""

    detail: str


# ============================================================================
# Push Notification Schemas
# ============================================================================


class PushSubscriptionKeys(BaseModel):
    """Web Push subscription keys from browser."""

    p256dh: str = Field(..., description="P-256 ECDH public key")
    auth: str = Field(..., description="Authentication secret")


class PushSubscriptionCreate(BaseModel):
    """Schema for registering a push subscription."""

    endpoint: str = Field(..., description="Push service endpoint URL")
    keys: PushSubscriptionKeys

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint_url(cls, v: str) -> str:
        """Validate that endpoint is a valid HTTPS push service URL."""
        if not v.startswith("https://"):
            raise ValueError("Push endpoint must use HTTPS")
        # Allow known push service domains
        allowed_domains = [
            "push.services.mozilla.com",
            "fcm.googleapis.com",
            "updates.push.services.mozilla.com",
            "android.googleapis.com",
            "notify.windows.com",
            "wns.windows.com",
            "web.push.apple.com",
        ]
        from urllib.parse import urlparse

        parsed = urlparse(v)
        hostname = parsed.hostname or ""
        if not any(hostname.endswith(domain) for domain in allowed_domains):
            raise ValueError(
                f"Push endpoint must be from a known push service provider"
            )
        return v


class PushSubscriptionDelete(BaseModel):
    """Schema for unsubscribing from push notifications."""

    endpoint: str = Field(..., description="Push service endpoint URL to remove")


class PushSubscriptionResponse(BaseModel):
    """Push subscription response."""

    id: str
    endpoint: str
    created_at: str
    last_used_at: str | None

    model_config = {"from_attributes": True}


class VapidPublicKeyResponse(BaseModel):
    """VAPID public key response for frontend."""

    public_key: str
    enabled: bool = True


class NotificationPreferencesUpdate(BaseModel):
    """Schema for updating notification preferences."""

    list_updates: str | None = Field(None, pattern="^(always|batched|off)$")
    list_sharing: str | None = Field(None, pattern="^(always|off)$")
    quiet_start: str | None = Field(None, pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$")
    quiet_end: str | None = Field(None, pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$")


class NotificationPreferencesResponse(BaseModel):
    """Notification preferences response."""

    list_updates: str = "batched"
    list_sharing: str = "always"
    quiet_start: str | None = None
    quiet_end: str | None = None

    model_config = {"from_attributes": True}
