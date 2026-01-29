"""Pydantic request/response schemas."""

from enum import Enum

from pydantic import BaseModel, Field


class ListType(str, Enum):
    """Valid list types."""

    GROCERY = "grocery"
    PACKING = "packing"
    TASKS = "tasks"


# ============================================================================
# User Schemas
# ============================================================================


class UserBase(BaseModel):
    """Base user schema."""

    clerk_user_id: str
    display_name: str
    email: str | None = None
    avatar_url: str | None = None


class UserCreate(BaseModel):
    """Schema for creating a user from Clerk data."""

    clerk_user_id: str
    display_name: str
    email: str | None = None
    avatar_url: str | None = None


class UserUpdate(BaseModel):
    """Schema for updating a user."""

    display_name: str | None = None
    email: str | None = None
    avatar_url: str | None = None


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
    ADMIN = "admin"


class ListShareCreate(BaseModel):
    """Schema for sharing a list with a user."""

    user_id: str
    permission: ListSharePermission = ListSharePermission.VIEW


class ListShareResponse(BaseModel):
    """List share response schema."""

    id: str
    list_id: str
    user_id: str
    permission: str
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


class ItemBase(BaseModel):
    """Base item schema."""

    name: str = Field(..., min_length=1, max_length=255)
    quantity: int = Field(default=1, ge=1)
    notes: str | None = None
    category_id: str | None = None


class ItemCreate(ItemBase):
    """Schema for creating a single item."""

    pass


class ItemBatchCreate(BaseModel):
    """Schema for batch creating items."""

    items: list[ItemCreate]


class ItemUpdate(BaseModel):
    """Schema for updating an item."""

    name: str | None = Field(None, min_length=1, max_length=255)
    quantity: int | None = Field(None, ge=1)
    notes: str | None = None
    category_id: str | None = None
    sort_order: int | None = None


class ItemResponse(ItemBase):
    """Item response schema."""

    id: str
    list_id: str
    is_checked: bool
    checked_by: str | None
    checked_at: str | None
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


class ListResponse(ListBase):
    """List response schema (without items)."""

    id: str
    owner_id: str | None
    is_template: bool
    created_at: str
    updated_at: str
    item_count: int = 0
    checked_count: int = 0

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
