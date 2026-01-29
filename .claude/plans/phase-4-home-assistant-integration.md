# Phase 4: Home Assistant Native Todo Platform Integration

## Status: Proposed Revision

The current Phase 4 implementation uses **sensor entities** to expose FamilyLists data
in Home Assistant. This document proposes migrating to HA's **native `todo` platform**
and explains in detail why that matters -- and where it doesn't.

---

## The Core Question: Why Bother?

FamilyLists has its own PWA. It has a good mobile UI, AI-powered categorization, meal
mode parsing, and a purpose-built experience for managing lists. **Nobody is going to
abandon the PWA and manage their grocery list through a Home Assistant dashboard.**

So why integrate with HA's native todo platform at all?

The answer is not about replacing the UI. It's about making FamilyLists a **first-class
citizen in the smart home ecosystem** so that HA can _see_, _react to_, and _act on_
list data without treating it as an opaque sensor blob.

---

## The Reusable Checklist Model

FamilyLists grocery lists work as **reusable checklists**, not one-time task lists:

1. You have a grocery list (e.g., "Fred Meyer") with your regular items
2. You shop and check off items as you get them
3. Completed items stay in the list with their category labels intact
4. Before your next shopping trip, you **restore** completed items (uncheck them)
5. You might remove a few items you don't need, then shop again

This means:
- Completed items are **rarely deleted** -- they persist for reuse
- Categories matter on completed items (for organization when restoring)
- A "restore completed" action is essential (manual, not automated)
- The PWA remains the primary UI for category-organized views

---

## What We Have Today (Sensor-Based)

The current integration creates `sensor.familylists_*` entities for each list. The
sensor state is a string like `"5 items"` and item details live in `extra_state_attributes`.

**What this gets us:**
- A number on a dashboard card ("Grocery List: 5 items")
- Basic automations that trigger when the item count changes
- Custom services (`familylists.add_item`, etc.) for adding/checking items
- Voice commands via custom sentences and intent handlers

**What this does NOT get us:**
- HA has no idea what the items actually are (they're buried in attributes)
- No native UI for viewing or interacting with individual items
- No interoperability with HA's todo ecosystem (cards, automations, voice)
- Every interaction requires custom services instead of standard ones
- Other integrations and automations can't consume the data naturally
- Template sensors that want to inspect items must parse attribute dictionaries

---

## What the Native Todo Platform Gives Us

### 1. Visibility Without Switching Apps

**The biggest practical benefit.** With todo entities, HA dashboards can show the
actual list contents -- not just a count. A wall-mounted tablet running HA in the
kitchen can show the grocery list in a native `todo-list` card. Someone walking by
can glance at it, check off an item, or add one.

This is NOT about replacing the PWA. It's about ambient visibility. The list exists
in more places without anyone needing to open an app.

```yaml
# Dashboard card -- works with zero custom code
type: todo-list
entity: todo.familylists_grocery_list
title: Grocery List
```

This card supports adding items, checking them off, and deleting them -- all built
into HA core. No iframe hacks. No custom cards.

### 2. Standard Automations That Actually Know About Items

With sensor entities, automations can only react to count changes:

```yaml
# Sensor-based: all you know is "the number changed"
trigger:
  - platform: state
    entity_id: sensor.familylists_grocery_list
```

With todo entities, automations can **query items by status** and make decisions:

```yaml
# Todo-based: get the actual items and do something with them
action:
  - action: todo.get_items
    target:
      entity_id: todo.familylists_grocery_list
    data:
      status: needs_action
    response_variable: grocery_items
  - action: notify.mobile_app_phone
    data:
      title: "Grocery Run"
      message: >
        You have {{ grocery_items['todo.familylists_grocery_list']['items'] | length }} items:
        {% for item in grocery_items['todo.familylists_grocery_list']['items'] %}
        - {{ item.summary }}
        {% endfor %}
```

**Concrete automation examples that become possible:**

| Automation | What It Does | Why It Matters |
|---|---|---|
| **Departure notification** | When someone leaves home, send a push notification listing unchecked grocery items | You don't forget the list when you're already at the store |
| **Evening digest** | At 8pm, announce remaining to-do items via a smart speaker | Family stays aware of open tasks without opening an app |
| **Arrival reminder** | When arriving at a geofenced store, send the grocery list | Context-aware reminders at the right time and place |
| **List reset button** | Dashboard button to restore all completed items for next shopping trip | Reusable checklist workflow |
| **Weekly summary** | Every Sunday, count items across all lists and post to a family chat | Planning visibility for the week |
| **Restock detection** | If the grocery list has > 10 unchecked items, change a dashboard indicator to "Time to shop" | Passive awareness without notifications |

All of these are possible with sensors + templates, but they require parsing attribute
dictionaries and wrestling with Jinja2. With todo entities, they use standard service
calls and response variables -- the way HA was designed to work.

### 3. Voice Commands Work for Free

The HA todo platform registers two built-in intents:

- **`ListAddItemIntent`**: "Add eggs to the grocery list"
- **`ListCompleteItemIntent`**: "Mark eggs as done on the grocery list"

These work with **any** `todo.*` entity automatically. Our current implementation
required writing 5 custom intent handlers and a custom sentences YAML file. With
todo entities, the basic add/complete voice commands just work out of the box through
HA Assist, Google Home (via Nabu Casa), or any voice pipeline.

We can still keep custom sentences for more natural phrasing (e.g., "What's on my
grocery list?"), but the fundamental voice control comes free.

### 4. Interoperability With the HA Ecosystem

Todo entities are a standard entity type. This means:

- **Any HACS card** built for todo entities works with FamilyLists
- **Other automations** in HA that work with todo lists can include FamilyLists
- **Scripts and scenes** can manipulate list items using standard calls
- **Template sensors** can easily count or filter items:
  ```yaml
  {{ state_attr('todo.familylists_grocery_list', 'todo_items')
     | selectattr('status', 'eq', 'needs_action') | list | length }}
  ```
- **Conditional cards** can show/hide based on whether a list has items
- **Third-party integrations** that consume todo data (e.g., notification services,
  family dashboards) work without custom adapters

### 5. Proper Entity Semantics

HA treats entity types differently in the UI:

- **Sensors** show up in the "Sensors" section of the entity list
- **Todo entities** show up in the dedicated **"To-do lists"** sidebar section

This matters because:
- Users expect to find lists in the "To-do lists" section, not sensors
- HA's built-in todo dashboard automatically lists all `todo.*` entities
- Entity-type-specific features (like the todo card) only work with the right type
- It's the difference between "this integration exposes some numbers" and "this
  integration provides actual lists that HA understands as lists"

---

## What the Native Todo Platform Does NOT Give Us

Honest assessment of limitations:

### No Item-Level Events (Yet)

HA does **not** fire events when individual todo items are added, completed, or removed.
The only trigger is `state_changed` when the unchecked item count changes. This is a
known limitation and an active feature request in the HA community. When HA eventually
adds item-level events, todo entities will get them automatically -- sensor entities
won't.

### No Category Support in Todo Platform

`TodoItem` has: `summary`, `uid`, `status`, `due`, `description`. That's it. No
categories, tags, priority, or custom metadata. FamilyLists' category system (Produce,
Dairy, etc.) cannot be represented natively in the todo platform.

**Mitigation:** Categories remain a FamilyLists-backend concern. The PWA is still the
right place for category-organized views. The HA integration provides a flat item list,
which is fine for the use cases that matter in HA (visibility, voice, automation). We
encode the category in the `description` field so it's visible in HA dashboards:

```python
# In todo.py item mapping:
description = f"[{item['category']['name']}]" if item.get('category') else None
```

**Important:** Completed items retain their category assignments in the backend. When
restored (unchecked), they appear in their original category in the PWA.

### No Quantity as a Native Field

FamilyLists items can have quantities (e.g., "Milk x2"). The todo platform has no
quantity field. We'd encode quantity in the summary (e.g., "Milk (x2)") or description.

### Basic Native Card

The built-in `todo-list` card is functional but basic -- no grouping, no sorting, no
category headers. For a rich list management experience, the PWA is still far superior.
This reinforces that the HA integration is about visibility and automation, not about
replacing the primary UI.

---

## Implementation Plan

### Phase 4A: Add Todo Entity Platform (Additive)

Add `todo.py` alongside the existing `sensor.py`. Both entity types coexist. This is
the safest migration path -- nothing breaks for existing users.

#### New File: `custom_components/familylists/todo.py`

```
class FamilyListsTodoEntity(CoordinatorEntity, TodoListEntity):
```

**Responsibilities:**
- One entity per FamilyList list (e.g., `todo.familylists_grocery_list`)
- `todo_items` property returns `list[TodoItem]` mapped from coordinator data
- Implements `async_create_todo_item` (maps to backend POST item)
- Implements `async_update_todo_item` (maps to backend check/uncheck + rename)
- Implements `async_delete_todo_items` (maps to backend DELETE item)
- Sets `supported_features = CREATE | UPDATE | DELETE | SET_DESCRIPTION`

**API Client Additions Required:**

1. **Update item** (for renaming via HA):

```python
async def update_item(
    self,
    item_id: str,
    name: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    """Update an item's name or notes."""
    data = {}
    if name is not None:
        data["name"] = name
    if notes is not None:
        data["notes"] = notes
    return await self._request("PATCH", f"/items/{item_id}", data)
```

2. **Restore completed items** (uncheck all checked items):

```python
async def restore_completed(self, list_id: str) -> dict[str, Any]:
    """Restore (uncheck) all completed items in a list."""
    return await self._request("POST", f"/lists/{list_id}/restore")
```

**Backend Endpoints Required:**

- `PATCH /items/{item_id}` - Update item name/notes
- `POST /lists/{list_id}/restore` - Uncheck all checked items (preserves categories)

**Item Mapping:**

| FamilyLists Field | TodoItem Field | Notes |
|---|---|---|
| `id` | `uid` | Unique identifier |
| `name` | `summary` | Item display name; append `(x{quantity})` if quantity > 1 |
| `is_checked=True` | `status=COMPLETED` | |
| `is_checked=False` | `status=NEEDS_ACTION` | |
| `notes` | `description` | Direct mapping |
| `category.name` | (not mapped) | OR optionally prepend to `description` |
| `quantity` | (encoded in summary) | `"Milk (x2)"` if quantity > 1 |
| `checked_at` | (not mapped) | No equivalent in TodoItem |

**Coordinator Changes:**
- Coordinator already fetches lists and items -- no changes needed for reads
- After any mutation (create/update/delete), call `await self.coordinator.async_request_refresh()`
- The coordinator's existing polling keeps the todo entity in sync with changes
  made via the PWA

#### Update: `custom_components/familylists/__init__.py`

```python
PLATFORMS = ["sensor", "todo"]  # Add todo platform
```

Both platforms share the same coordinator instance and API client.

#### No Change Needed: `custom_components/familylists/coordinator.py`

The coordinator already stores raw item data alongside count summaries:

```python
# Already implemented in coordinator.py:
result[list_id] = {
    **lst,
    "items": items,  # Raw item list already available
    "total_items": len(items),
    "checked_items": checked,
    "unchecked_items": unchecked,
}
```

No coordinator changes are required for read operations. The todo entity can
directly access `self.coordinator.data[list_id]["items"]` to build `TodoItem` objects.

#### Keep: Voice intent handlers

Custom sentences and intent handlers remain for richer voice support ("What's on my
grocery list?", "Clear the grocery list"). The basic add/complete intents come free
from the todo platform, but our custom handlers provide more natural phrasing and
additional capabilities (get items, clear completed).

Note: Our custom intents use namespaced names (`FamilyListsAddItem`, `FamilyListsCheckItem`,
etc.) which don't conflict with HA's built-in todo intents (`HassListAddItem`,
`HassListCompleteItem`). Both can coexist -- the built-in intents provide basic
functionality while our custom intents offer richer phrasing and additional
capabilities like `FamilyListsGetItems` and `FamilyListsClearCompleted`.

### Phase 4B: Enhance Automations (After 4A is stable)

With todo entities in place, provide example automations that demonstrate the value:

**1. Departure Grocery Notification**
```yaml
alias: "Grocery list on departure"
trigger:
  - platform: zone
    entity_id: person.brett
    zone: zone.home
    event: leave
condition:
  - condition: template
    value_template: "{{ states('todo.familylists_grocery_list') | int > 0 }}"
action:
  - action: todo.get_items
    target:
      entity_id: todo.familylists_grocery_list
    data:
      status: needs_action
    response_variable: items
  - action: notify.mobile_app
    data:
      title: "Don't forget your grocery list"
      message: >
        {{ items['todo.familylists_grocery_list']['items'] | map(attribute='summary') | join(', ') }}
```

**2. Evening Task Digest via Speaker**
```yaml
alias: "Evening task summary"
trigger:
  - platform: time
    at: "20:00:00"
action:
  - action: todo.get_items
    target:
      entity_id: todo.familylists_to_do
    data:
      status: needs_action
    response_variable: tasks
  - action: tts.speak
    target:
      entity_id: tts.google
    data:
      message: >
        You have {{ tasks['todo.familylists_to_do']['items'] | length }} tasks remaining.
```

**3. Voice-Triggered List Reset**

FamilyLists uses a **reusable checklist** model: you shop, check off items, and
later restore them for the next trip. Completed items are rarely deleted -- they
persist with their category labels intact so you can selectively restore them.

This is manual, not automated. Example voice command via custom intent:

```yaml
# Custom sentence in sentences/en/familylists.yaml
- sentences:
    - "reset [the] {list_name} [list]"
  intent: FamilyListsRestoreCompleted
```

Or trigger via a dashboard button:

```yaml
type: button
name: "Reset Grocery List"
tap_action:
  action: call-service
  service: familylists.restore_completed
  data:
    list_name: "Fred Meyer"
```

Note: This requires a new `restore_completed` service and intent (see Backend Changes).

### Phase 4C: Evaluate Sensor Deprecation

After the todo entities have been running for a while, evaluate whether the sensor
entities still provide value:

- **Keep sensors if:** Users rely on the numeric state for simple Lovelace badges
  or energy-dashboard-style tracking. Sensors are good for "how many items" at a
  glance.
- **Remove sensors if:** The todo entity state (which is also the unchecked count)
  covers the same use case. A template sensor can always derive counts from a todo
  entity if needed.

Recommendation: Keep both for at least one release cycle, then deprecate sensors
with a warning log message, then remove in a subsequent release.

---

## What About HA Login / Authentication?

The current integration authenticates to the FamilyLists backend using an API key
configured during setup. This is the standard pattern for HA integrations (Todoist
uses OAuth, Bring uses username/password, etc.).

**Should FamilyLists accept HA login credentials?**

For a family-shared list app, probably not. Here's why:

- HA integrations authenticate _to external services_, not the other way around
- FamilyLists doesn't have per-user permissions -- everyone shares the same lists
- Adding HA as an identity provider would mean the backend needs to validate HA
  tokens, which tightly couples it to HA
- The API key approach is simple, works, and is how most local integrations operate

**Where HA user identity could matter:**

- **Audit trails**: Passing the HA user ID when checking off items so the backend
  records who did it. The current API supports `user_id` on check operations. The
  todo entity's `async_update_todo_item` could pass `self.hass.auth.async_get_owner()`
  or the config entry's user context.
- **Per-user notifications**: Different HA users might want notifications for
  different lists. This is handled at the HA automation level, not the integration
  level.

**Recommendation:** Keep API key auth. Optionally pass HA user context on write
operations for audit purposes, but don't build an HA-as-identity-provider flow.

---

## Summary: Is This Worth Doing?

| Factor | Sensor Approach | Todo Platform | Verdict |
|---|---|---|---|
| Dashboard visibility | Count badge only | Full item list, interactive | **Todo wins** |
| Voice commands | 5 custom intents | 2 built-in + custom extras | **Todo wins** |
| Automation item access | Parse attributes | `todo.get_items` service | **Todo wins** |
| Category display | In attributes | Not supported natively | **Sensor wins** |
| Ecosystem compatibility | Non-standard | Standard todo entity | **Todo wins** |
| Setup complexity | Simpler | Slightly more code | **Sensor wins** |
| Primary list management | Not suitable | Still not suitable (use PWA) | **Tie** |

**The todo platform is worth implementing** because it transforms FamilyLists from
"an app that exposes a number to HA" into "lists that HA natively understands."
The primary UI remains the PWA. The HA integration provides ambient visibility,
voice control, and automation hooks that make the lists useful in contexts where
nobody is going to open an app -- a wall tablet, a voice command while cooking,
an automated notification when leaving the house.

The effort is moderate (one new HA file, one new API method, one backend endpoint)
and the payoff is meaningful for anyone running FamilyLists in a Home Assistant
household.

---

## File Change Summary

| File | Action | Description |
|---|---|---|
| `custom_components/familylists/todo.py` | **Create** | New `TodoListEntity` implementation |
| `custom_components/familylists/__init__.py` | **Modify** | Add `"todo"` to `PLATFORMS` list |
| `custom_components/familylists/api.py` | **Modify** | Add `update_item` method for item renaming |
| `custom_components/familylists/coordinator.py` | **No change** | Already stores raw item data |
| `custom_components/familylists/manifest.json` | **Modify** | Bump version to 1.1.0 |
| `custom_components/familylists/README.md` | **Modify** | Document todo entities and new automation examples |
| `custom_components/familylists/sensor.py` | **No change** | Kept for backwards compatibility |
| `custom_components/familylists/intent.py` | **Modify** | Add `FamilyListsRestoreCompleted` intent |
| `custom_components/familylists/services.yaml` | **Modify** | Add `restore_completed` service |
| `backend/app/api/items.py` | **Modify** | Add `PATCH /items/{id}` endpoint for updates |
| `backend/app/api/lists.py` | **Modify** | Add `POST /lists/{id}/restore` endpoint |
