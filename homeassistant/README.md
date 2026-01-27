# FamilyLists Home Assistant Integration

Custom integration for [FamilyLists](https://github.com/brettcrane/familylist) - a family-friendly list management application.

## Features

- **Sensor entities** for each list showing item counts
- **Service calls** to add, check, uncheck items
- **Voice control** via Google Assistant (with custom sentences)
- **Automations** based on list state

## Installation

### HACS (Recommended)

1. Add this repository as a custom repository in HACS
2. Search for "FamilyLists" and install
3. Restart Home Assistant
4. Add integration via Settings > Devices & Services

### Manual

1. Copy `custom_components/familylists` to your HA `custom_components` directory
2. Restart Home Assistant
3. Add integration via Settings > Devices & Services

## Configuration

1. Go to Settings > Devices & Services
2. Click "Add Integration"
3. Search for "FamilyLists"
4. Enter your backend URL (e.g., `http://pve3.local:8000`)
5. Enter your API key (leave empty if authentication is disabled)

## Entities

Each list creates a sensor entity:

```yaml
sensor.familylists_grocery_list:
  state: "5 items"
  attributes:
    list_id: "uuid"
    list_type: "grocery"
    total_items: 8
    checked_items: 3
    unchecked_items: 5
```

## Services

### familylists.add_item

Add an item to a list.

```yaml
service: familylists.add_item
data:
  list_name: "Grocery List"
  item: "Milk"
  quantity: 2
```

### familylists.check_item

Mark an item as checked.

```yaml
service: familylists.check_item
data:
  list_name: "Grocery List"
  item: "Milk"
```

### familylists.uncheck_item

Uncheck an item (undo).

```yaml
service: familylists.uncheck_item
data:
  list_name: "Grocery List"
  item: "Milk"
```

### familylists.clear_completed

Remove all checked items from a list.

```yaml
service: familylists.clear_completed
data:
  list_name: "Grocery List"
```

### familylists.refresh

Force refresh all list data.

```yaml
service: familylists.refresh
```

## Lovelace Dashboard

### Iframe Card (Full PWA)

Add the PWA to your dashboard as an iframe:

```yaml
type: iframe
url: http://pve3.local:8000
aspect_ratio: 100%
```

For a panel view (full page):

```yaml
views:
  - title: Shopping
    path: shopping
    panel: true
    cards:
      - type: iframe
        url: http://pve3.local:8000
        aspect_ratio: 100%
```

### Entities Card (Quick Overview)

Show list status on your main dashboard:

```yaml
type: entities
title: Shopping Lists
entities:
  - entity: sensor.familylists_grocery_list
    name: Grocery
  - entity: sensor.familylists_packing_list
    name: Packing
  - entity: sensor.familylists_to_do
    name: To Do
```

### Markdown Card (Item Preview)

Show unchecked items inline:

```yaml
type: markdown
title: Grocery List
content: |
  {% set items = state_attr('sensor.familylists_grocery_list', 'unchecked_items') %}
  {% if items == 0 %}
  ✓ All done!
  {% else %}
  {{ items }} items remaining
  {% endif %}
```

## Example Automations

### Notify on arrival at grocery store

```yaml
automation:
  - alias: "Grocery Store Arrival"
    trigger:
      - platform: zone
        entity_id: person.brett
        zone: zone.grocery_store
        event: enter
    condition:
      - condition: numeric_state
        entity_id: sensor.familylists_grocery_list
        attribute: unchecked_items
        above: 0
    action:
      - service: notify.mobile_app_phone
        data:
          title: "Grocery List"
          message: >
            You have {{ state_attr('sensor.familylists_grocery_list', 'unchecked_items') }} items to get
```

### Weekly reminder

```yaml
automation:
  - alias: "Sunday Grocery Reminder"
    trigger:
      - platform: time
        at: "09:00:00"
    condition:
      - condition: time
        weekday: sun
      - condition: numeric_state
        entity_id: sensor.familylists_grocery_list
        attribute: unchecked_items
        above: 0
    action:
      - service: notify.family
        data:
          title: "Grocery List"
          message: >
            {{ state_attr('sensor.familylists_grocery_list', 'unchecked_items') }} items on the list
```

## Voice Commands (Google Assistant)

Voice commands are built-in via HA's conversation integration. Copy the custom sentences file to your HA config:

1. Copy `custom_sentences/en/familylists.yaml` to your HA `custom_sentences/en/` directory
2. Restart Home Assistant

**Supported voice commands:**

| Command | Example |
|---------|---------|
| Add item | "Add milk to the grocery list" |
| Check off | "Check off milk from the grocery list" |
| Uncheck | "Put milk back on the grocery list" |
| Clear completed | "Clear the grocery list" |
| Read list | "What's on my grocery list?" |

**Supported list aliases:**
- "grocery" / "groceries" / "shopping" → Grocery List
- "packing" / "pack" → Packing List
- "todo" / "tasks" / "to do" → To Do

The integration automatically handles the intent responses with natural speech.

## Troubleshooting

### Cannot connect to backend

- Verify the backend URL is accessible from your HA instance
- Check if the API key is correct
- Ensure the FamilyLists container is running

### Entities not updating

- Check the poll interval (default: 30 seconds)
- Call `familylists.refresh` service to force update
- Check HA logs for errors
