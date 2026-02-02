# FamilyList TODO

## Future Enhancements

- [ ] **Undo toast for item deletion** - Show temporary toast with "Undo" button after deleting an item, allowing quick restore. Requires storing deleted item data and re-creating via POST (no undelete endpoint).

- [ ] **Trash / soft delete system** - Instead of permanently deleting items, move them to a "trash" state. Could include:
  - Add `deleted_at` timestamp field to Item model (soft delete pattern)
  - Filter out deleted items from normal queries
  - Add "Trash" view to see recently deleted items
  - Auto-purge items after 30 days in trash
  - "Restore" and "Delete Permanently" actions in trash view
  - This would make "Delete All Completed" recoverable

- [ ] **Activity history / recently modified view** - Track item changes for transparency and undo capability:
  - New `ItemHistory` table: item_id, action (created/checked/unchecked/deleted/updated), timestamp, user_id, previous_values
  - "History" tab or modal showing recent activity across the list
  - Filter by: all activity, my activity, others' activity
  - Could combine with trash concept - deleted items appear in history with "restore" option
  - Useful for shared lists to see who did what
  - Consider: time-based grouping (today, yesterday, this week)

## Bugs to Investigate

- [ ] **Meal mode AI parsing inconsistency** - Sometimes when meal mode (chef hat toggle) is enabled, items are added directly to the list instead of being deconstructed into ingredients by the AI.
  - Check if `mealMode` state is correctly passed to the API call
  - Verify `useNaturalLanguage: true` flag is sent when meal mode is active
  - Add backend logging to see what OpenAI returns
  - Check if JSON parsing of LLM response fails silently
  - Reproduce: "stuff for chili" works sometimes but not always
