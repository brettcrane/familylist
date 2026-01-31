"""Constants for FamilyLists integration."""

DOMAIN = "familylists"

# Configuration
CONF_BACKEND_URL = "backend_url"
CONF_API_KEY = "api_key"
CONF_POLL_INTERVAL = "poll_interval"

# Defaults
DEFAULT_POLL_INTERVAL = 30  # seconds
DEFAULT_BACKEND_URL = "http://pve3.local:8000"

# Attributes
ATTR_LIST_ID = "list_id"
ATTR_LIST_TYPE = "list_type"
ATTR_TOTAL_ITEMS = "total_items"
ATTR_CHECKED_ITEMS = "checked_items"
ATTR_UNCHECKED_ITEMS = "unchecked_items"
ATTR_LAST_UPDATED = "last_updated"
ATTR_LAST_UPDATED_BY = "last_updated_by"

# Sharing awareness attributes
ATTR_IS_SHARED = "is_shared"
ATTR_SHARE_COUNT = "share_count"
ATTR_LAST_CHECKED_ITEM = "last_checked_item"
ATTR_LAST_CHECKED_BY = "last_checked_by"
ATTR_LAST_CHECKED_BY_NAME = "last_checked_by_name"
ATTR_LAST_CHECKED_AT = "last_checked_at"
