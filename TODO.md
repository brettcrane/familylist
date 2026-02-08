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

- [ ] **LLM parsing test coverage** - `LLMParsingService` has zero unit tests. Priority:
  1. Unit tests for `_extract_json()` — structured output `{"items": [...]}`, bare arrays, markdown code blocks, empty/invalid inputs
  2. Unit tests for `_call_openai()` — verify `response_format` sent for GPT-5 models, not for others; mock `chat.completions.create`
  3. Integration test for `parse()` with mocked backend — end-to-end flow from input to `ParsedItem` list, verify correct prompt template selected per list type and fallback to grocery for unknown types
  4. HTTP-level tests for `/api/ai/parse` endpoint — 503 when unavailable, success with mocked LLM, auth required

## Research

- [ ] **Claude Cowork → FamilyList integration** - We use Claude Cowork as a collaborator to build task lists, determine priority, and assign items between family members. Research how to pipe that output directly into FamilyList instead of manually re-entering it:
  - **MCP server for FamilyList** — Could FamilyList expose an MCP server so Claude Cowork can create lists, add items, set magnitude, and assign users directly via tool calls?
  - **API-based integration** — Claude Cowork could call the FamilyList REST API directly (with an API key or Clerk token) to create/update items. What auth flow works best for an agent context?
  - **Structured output format** — Define a schema that Claude Cowork outputs (list name, items with categories, magnitude, assigned_to) that FamilyList can ingest, similar to the existing NL parse flow
  - **Bulk import endpoint** — May need a new API endpoint for batch-creating a full list with items, categories, magnitudes, and assignments in one call (beyond current `batch_create`)
  - **Identity mapping** — How does Claude Cowork know the user IDs for "me" and "my wife"? Could use display names resolved to Clerk user IDs, or a simple name→ID config
  - **Two-way sync** — Could Claude Cowork also read existing FamilyList data to avoid duplicates and understand current state when planning?
  - **Privacy/security** — Evaluate what data Claude Cowork needs access to and whether API key scoping or read/write permissions are needed

- [ ] **In-depth review of offline/hybrid mode** - Audit the offline queue and hybrid sync system for security, correctness, and whether it's worth maintaining:
  - **Security audit:**
    - Is data stored in IndexedDB encrypted or accessible to other origins/extensions?
    - Are auth tokens (Clerk JWT, API key) stored securely in the offline context?
    - Can queued mutations be tampered with or replayed?
    - What happens to cached data after logout — is it properly cleared?
  - **Correctness audit:**
    - Test the full offline → online sync cycle: queue mutations offline, reconnect, verify they apply correctly
    - Check conflict resolution: what if another user modified the same item while offline?
    - Verify the `useOfflineQueue` IndexedDB queue handles failures, retries, and ordering correctly
    - Test SSE reconnection (`useListStream`) after prolonged offline periods
    - Check if optimistic updates in `useItems` roll back properly on sync failure
  - **Worth-having assessment:**
    - How much code complexity does offline support add? (IndexedDB queue, sync indicator, service worker caching)
    - Do real users actually use the app offline, or is connectivity always available?
    - Would a simpler "read-only offline" mode (cached views, no mutation queue) be sufficient?
    - Compare maintenance burden vs. user value — is this a feature we should invest in or deprecate?

## Bugs to Investigate

- [ ] **AI mode parsing inconsistency** - Sometimes when AI mode (sparkles toggle) is enabled, items are added directly to the list instead of being deconstructed by the LLM.
  - Check if `aiMode` state is correctly passed through to the `parseNaturalLanguage()` API call
  - Add backend logging to see what OpenAI returns
  - Check if JSON parsing of LLM response fails silently (improved: catch blocks now log errors, `_extract_json` logs on failure)
  - Reproduce: "stuff for chili" works sometimes but not always
  - Likely mitigated by GPT-5 Nano structured JSON output (less JSON parse failures)
