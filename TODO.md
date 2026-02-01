# FamilyList TODO

## Future Enhancements

- [ ] **Undo toast for item deletion** - Show temporary toast with "Undo" button after deleting an item, allowing quick restore. Requires storing deleted item data and re-creating via POST (no undelete endpoint).

## Bugs to Investigate

- [ ] **Meal mode AI parsing inconsistency** - Sometimes when meal mode (chef hat toggle) is enabled, items are added directly to the list instead of being deconstructed into ingredients by the AI.
  - Check if `mealMode` state is correctly passed to the API call
  - Verify `useNaturalLanguage: true` flag is sent when meal mode is active
  - Add backend logging to see what OpenAI returns
  - Check if JSON parsing of LLM response fails silently
  - Reproduce: "stuff for chili" works sometimes but not always
