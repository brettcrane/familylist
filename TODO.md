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

- [ ] **Subtask / parent-child item hierarchy** - Add `parent_id` (self-referential FK) to Item model for subtask support. Enables project decomposition (e.g., "Estate Planning" → will, POA, healthcare proxy). UI would show indented subtasks under parent items with collapsible groups. Blocked-until semantics optional. Only relevant for task-type lists.

- [ ] **Focus view (Today / This Week)** - Filtered landing view for task lists showing only: overdue items, due this week, urgent/high priority, assigned to current user. Frontend-only filter on existing data (no new backend endpoints beyond the filtering added in Cowork Step 2). Default mobile landing screen.

- [ ] **LLM parsing test coverage** - `LLMParsingService` has zero unit tests. Priority:
  1. Unit tests for `_extract_json()` — structured output `{"items": [...]}`, bare arrays, markdown code blocks, empty/invalid inputs
  2. Unit tests for `_call_openai()` — verify `response_format` sent for GPT-5 models, not for others; mock `chat.completions.create`
  3. Integration test for `parse()` with mocked backend — end-to-end flow from input to `ParsedItem` list, verify correct prompt template selected per list type and fallback to grocery for unknown types
  4. HTTP-level tests for `/api/ai/parse` endpoint — 503 when unavailable, success with mocked LLM, auth required

## Cowork Integration (Full Plan)

Research complete — see `docs/research/cowork-integration-research.md` for full details.

- [ ] **Step 1: Backend schema — task management fields** - Add nullable fields to Item model for task list functionality:
  - `priority` (urgent/high/medium/low) — `Priority(str, Enum)` + CheckConstraint, shown only for task lists
  - `due_date` (date, nullable) — deadline for task items
  - `status` (open/in_progress/done/blocked) — `ItemStatus(str, Enum)` + CheckConstraint, richer than `is_checked` for tasks
  - `created_by` (FK to users.id, nullable) — tracks who created the item (human or Claude)
  - Sync logic: `status=done` ↔ `is_checked=True` for task items; grocery/packing keep using `is_checked` only
  - Update schemas (ItemCreate/ItemUpdate/ItemResponse), serializer, and tests
  - Create "Claude" system user for created_by tracking
  - Alembic migration (all nullable columns, no data migration needed)

- [ ] **Step 2: API filtering enhancements** - Extend `GET /api/lists/{list_id}/items` with query params:
  - `?status=open,in_progress` `?priority=urgent,high` `?due_before=2026-03-01` `?created_by=claude-system`
  - Add `GET /api/users/lookup?name=Brett` for identity resolution

- [ ] **Step 3: MCP server endpoint** - Expose FamilyList API as MCP tools for Claude Cowork:
  - Add `fastapi-mcp` dependency, mount `/mcp` endpoint on existing FastAPI app
  - Verify API key auth works with MCP `authorization_token` (Bearer token flow)
  - Test with MCP Inspector
  - Optionally add custom high-level tools (create_task_list_with_items, get_weekly_summary, bulk_update_items)

- [ ] **Step 4: Frontend — task fields UI** - Conditional rendering for task-type lists:
  - Priority dropdown + color-coded badge in ItemRow (red/orange/yellow/green)
  - Due date picker + overdue indicator
  - Status dropdown (open/in_progress/done/blocked)
  - "Created by Claude" badge on AI-created items
  - `PRIORITY_CONFIG` and `STATUS_CONFIG` in types/api.ts (same pattern as MAGNITUDE_CONFIG)

- [ ] **Step 5: Cowork plugin** - Build a FamilyList plugin for Claude Cowork:
  - `.claude-plugin/plugin.json` manifest
  - `.mcp.json` connecting to FamilyList MCP endpoint with API key
  - `skills/familylist-schema.md` — list types, item fields, categories, magnitude, priority
  - `skills/family-context.md` — Brett/Aly user IDs, assignment guidelines
  - `commands/add-tasks.md` — /add-tasks slash command
  - `commands/weekly-digest.md` — /weekly-digest slash command

- [ ] **Step 6: End-to-end testing** - Verify full Cowork → FamilyList flow:
  - Claude creates items via MCP → items appear in app
  - Push notifications fire for Claude-created items
  - SSE real-time updates show Claude activity to other connected clients
  - Assignment validation works for Claude-created items

- [x] **Offline mode audit → read-only offline implemented** - Reviewed the offline/hybrid system and found: the mutation queue (`useOfflineQueue.ts`, 220 lines) was dead code with zero callers; no React Query cache persistence; no SW API caching; logout didn't clear cached data (security bug). Replaced with read-only offline:
  - Deleted `useOfflineQueue.ts` and all references (dead mutation queue, sync indicator queue UI, pending mutation dots)
  - Added `PersistQueryClientProvider` with IndexedDB-backed cache (`idb-keyval`) — lists persist across sessions
  - Added `NetworkFirst` service worker API caching for GET requests to `/api/lists*`, `/api/items*`, `/api/categories*`
  - Added logout cleanup: clears React Query cache, SW API cache, and legacy localStorage
  - Simplified `SyncIndicator` to offline-only pill (no more "Syncing N..." for dead queue)
  - Intentionally skipped: mutation queue/CRDTs, Background Sync API — read-only is sufficient for our use case

## Bugs to Investigate

- [ ] **AI mode parsing inconsistency** - Sometimes when AI mode (sparkles toggle) is enabled, items are added directly to the list instead of being deconstructed by the LLM.
  - Check if `aiMode` state is correctly passed through to the `parseNaturalLanguage()` API call
  - Add backend logging to see what OpenAI returns
  - Check if JSON parsing of LLM response fails silently (improved: catch blocks now log errors, `_extract_json` logs on failure)
  - Reproduce: "stuff for chili" works sometimes but not always
  - Likely mitigated by GPT-5 Nano structured JSON output (less JSON parse failures)
