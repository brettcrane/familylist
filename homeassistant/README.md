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

To enable voice commands, add custom sentences to your HA configuration.

Create `custom_sentences/en/familylists.yaml`:

```yaml
language: "en"
intents:
  AddToGroceryList:
    data:
      - sentences:
          - "add {item} to [the] grocery list"
          - "put {item} on [the] grocery list"
```

Then create an intent script in `configuration.yaml`:

```yaml
intent_script:
  AddToGroceryList:
    action:
      - service: familylists.add_item
        data:
          list_name: "Grocery List"
          item: "{{ item }}"
    speech:
      text: "Added {{ item }} to the grocery list"
```

## Troubleshooting

### Cannot connect to backend

- Verify the backend URL is accessible from your HA instance
- Check if the API key is correct
- Ensure the FamilyLists container is running

### Entities not updating

- Check the poll interval (default: 30 seconds)
- Call `familylists.refresh` service to force update
- Check HA logs for errors
