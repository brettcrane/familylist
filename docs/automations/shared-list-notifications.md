# Shared List Notifications for Home Assistant

This guide provides example automations for notifying family members when items are checked off shared lists.

## Prerequisites

1. FamilyLists custom component installed and configured
2. A shared grocery list (or other list type)
3. Mobile app notifications configured for family members

## Sensor Attributes

The FamilyLists sensor exposes these sharing-aware attributes:

| Attribute | Description |
|-----------|-------------|
| `is_shared` | Boolean indicating if the list is shared with others |
| `share_count` | Number of users the list is shared with |
| `last_checked_item` | Name of the most recently checked item |
| `last_checked_by` | User ID of who checked the item |
| `last_checked_by_name` | Display name of who checked the item |
| `last_checked_at` | Timestamp when the item was checked |

## Basic Notification Automation

Notify your partner when you check an item on a shared list:

```yaml
automation:
  - alias: "Notify Wife - Brett Checked Item"
    trigger:
      - platform: state
        entity_id: sensor.familylists_grocery_list
        attribute: last_checked_item
    condition:
      # Only if the list is shared
      - condition: template
        value_template: "{{ state_attr('sensor.familylists_grocery_list', 'is_shared') }}"
      # Only notify if Brett checked it (not wife)
      - condition: template
        value_template: "{{ state_attr('sensor.familylists_grocery_list', 'last_checked_by_name') == 'Brett' }}"
    action:
      - service: notify.mobile_app_wife_phone
        data:
          title: "Grocery List"
          message: >
            Brett checked "{{ state_attr('sensor.familylists_grocery_list', 'last_checked_item') }}"
```

## Two-Way Notifications

Notify each partner when the other checks an item:

```yaml
automation:
  - alias: "Notify Wife - Brett Checked Item"
    trigger:
      - platform: state
        entity_id: sensor.familylists_grocery_list
        attribute: last_checked_item
    condition:
      - condition: template
        value_template: "{{ state_attr('sensor.familylists_grocery_list', 'is_shared') }}"
      - condition: template
        value_template: "{{ state_attr('sensor.familylists_grocery_list', 'last_checked_by_name') == 'Brett' }}"
    action:
      - service: notify.mobile_app_wife_phone
        data:
          title: "Grocery List"
          message: >
            Brett checked "{{ state_attr('sensor.familylists_grocery_list', 'last_checked_item') }}"

  - alias: "Notify Brett - Wife Checked Item"
    trigger:
      - platform: state
        entity_id: sensor.familylists_grocery_list
        attribute: last_checked_item
    condition:
      - condition: template
        value_template: "{{ state_attr('sensor.familylists_grocery_list', 'is_shared') }}"
      - condition: template
        value_template: "{{ state_attr('sensor.familylists_grocery_list', 'last_checked_by_name') == 'Aly' }}"
    action:
      - service: notify.mobile_app_brett_phone
        data:
          title: "Grocery List"
          message: >
            Aly checked "{{ state_attr('sensor.familylists_grocery_list', 'last_checked_item') }}"
```

## Single Automation with Dynamic Routing

A more maintainable approach using a single automation:

```yaml
automation:
  - alias: "Notify Others - Item Checked on Shared List"
    trigger:
      - platform: state
        entity_id: sensor.familylists_grocery_list
        attribute: last_checked_item
    condition:
      - condition: template
        value_template: "{{ state_attr('sensor.familylists_grocery_list', 'is_shared') }}"
    action:
      - choose:
          - conditions:
              - condition: template
                value_template: "{{ state_attr('sensor.familylists_grocery_list', 'last_checked_by_name') == 'Brett' }}"
            sequence:
              - service: notify.mobile_app_wife_phone
                data:
                  title: "Grocery List"
                  message: "Brett checked \"{{ state_attr('sensor.familylists_grocery_list', 'last_checked_item') }}\""
          - conditions:
              - condition: template
                value_template: "{{ state_attr('sensor.familylists_grocery_list', 'last_checked_by_name') == 'Aly' }}"
            sequence:
              - service: notify.mobile_app_brett_phone
                data:
                  title: "Grocery List"
                  message: "Aly checked \"{{ state_attr('sensor.familylists_grocery_list', 'last_checked_item') }}\""
```

## Blueprint for Reusability

Create a blueprint to easily set up notifications for multiple lists:

Save as `config/blueprints/automation/familylists_notify_shared_check.yaml`:

```yaml
blueprint:
  name: FamilyLists Shared Check Notification
  description: Notify a user when a specific family member checks an item on a shared list
  domain: automation
  input:
    list_sensor:
      name: List Sensor
      description: The FamilyLists sensor entity
      selector:
        entity:
          integration: familylists
          domain: sensor
    checker_name:
      name: Checker Name
      description: Display name of the person checking items (e.g., "Brett")
      selector:
        text:
    notify_service:
      name: Notification Service
      description: The notify service to use (e.g., notify.mobile_app_wife_phone)
      selector:
        text:
    notification_title:
      name: Notification Title
      description: Title for the notification
      default: "Grocery List"
      selector:
        text:

trigger:
  - platform: state
    entity_id: !input list_sensor
    attribute: last_checked_item

condition:
  - condition: template
    value_template: "{{ state_attr(trigger.entity_id, 'is_shared') }}"
  - condition: template
    value_template: "{{ state_attr(trigger.entity_id, 'last_checked_by_name') == '{{ !input checker_name }}' }}"

action:
  - service: !input notify_service
    data:
      title: !input notification_title
      message: >
        {{ !input checker_name }} checked "{{ state_attr(trigger.entity_id, 'last_checked_item') }}"
```

## Grocery Store Arrival Notification

Notify your partner when you arrive at the grocery store (useful for last-minute additions):

```yaml
automation:
  - alias: "Notify Wife - Brett at Grocery Store"
    trigger:
      - platform: zone
        entity_id: person.brett
        zone: zone.grocery_store
        event: enter
    condition:
      - condition: template
        value_template: >
          {{ state_attr('sensor.familylists_grocery_list', 'unchecked_items') | int > 0 }}
    action:
      - service: notify.mobile_app_wife_phone
        data:
          title: "Brett at Store"
          message: >
            Brett just arrived at the grocery store.
            {{ state_attr('sensor.familylists_grocery_list', 'unchecked_items') }} items remaining on the list.
          data:
            actions:
              - action: OPEN_LIST
                title: "Open List"
                uri: "familylists://list/{{ state_attr('sensor.familylists_grocery_list', 'list_id') }}"
```

## Weekly Reminder Automation

Send a reminder to check the grocery list before the weekly shopping trip:

```yaml
automation:
  - alias: "Weekly Grocery List Reminder"
    trigger:
      - platform: time
        at: "09:00:00"
    condition:
      - condition: time
        weekday:
          - sat  # Adjust to your shopping day
      - condition: template
        value_template: >
          {{ state_attr('sensor.familylists_grocery_list', 'unchecked_items') | int > 0 }}
    action:
      - service: notify.family_phones
        data:
          title: "Grocery List Reminder"
          message: >
            Don't forget! {{ state_attr('sensor.familylists_grocery_list', 'unchecked_items') }} items on the grocery list.
```

## Troubleshooting

### Notifications not firing?

1. Check that `is_shared` is `true` in Developer Tools → States
2. Verify `last_checked_by_name` matches exactly (case-sensitive)
3. Ensure the notification service name is correct

### Attribute showing `null`?

- Items need to be checked by authenticated users for `last_checked_by_name` to populate
- API key authentication doesn't track who checked items
- Make sure users are signed in via Clerk authentication

### Double notifications?

- The sensor polls every 30 seconds by default
- Multiple items checked quickly may trigger multiple notifications
- Consider adding a delay or cooldown condition:

```yaml
condition:
  - condition: template
    value_template: >
      {{ (as_timestamp(now()) - as_timestamp(state_attr('sensor.familylists_grocery_list', 'last_checked_at'))) < 60 }}
```

## Tips

1. **Test with Developer Tools**: Use Developer Tools → States to inspect sensor attributes before writing automations
2. **Use Templates**: Test your Jinja2 templates in Developer Tools → Template
3. **Start Simple**: Get basic notifications working before adding complex conditions
4. **Check Logs**: Enable debug logging for the FamilyLists integration if issues persist
