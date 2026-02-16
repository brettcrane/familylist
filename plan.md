# Plan: Handle Duplicate Items on Add

## Problem

When a user adds an item that already exists on the list, nothing prevents a duplicate from being created. The user has no awareness of existing items that match what they're typing. This leads to confusion — especially on shared lists where someone else may have already added the item.

## Core Principle: Create First, Correct After

The existing item entry flow clears the input instantly and creates the item via fire-and-forget. Duplicate detection must preserve this pattern — **never block or gate item creation**. The item is always created immediately. If it's a duplicate, a toast offers correction options (undo, merge quantity). If the user ignores the toast, the duplicate stays — a safe default that matches the user's intent ("I hit enter, so add it").

## Scenarios to Handle

### Scenario 1: Duplicate exists in Done (checked) items
**User intent:** "I need this again" — they almost certainly want it back on the active list.

**Proposed behavior:** Auto-uncheck the existing item (move it back to To Do) and show a brief toast: `"Milk moved back to your list"`. No prompt needed — this is the obvious action. If there are multiple checked matches, uncheck the most recently checked one.

**Quantity handling:** Keep the existing item's quantity as-is. The user can tap the item to adjust quantity if needed.

### Scenario 2: Duplicate exists in active (unchecked) items
**User intent:** Ambiguous — could be:
- They forgot it was already there
- They want more of it (increment quantity)
- They genuinely want a separate entry (e.g., different brand/variant)

**Proposed behavior:** Create the item immediately via the normal fire-and-forget flow (categorize + create), then show a **duplicate notification toast** above the input bar offering correction options. The input clears instantly as usual.

**Toast content:**
```
┌──────────────────────────────────────────┐
│  "Milk" is already on your list (×2)     │
│                                          │
│  [Undo]              [+1 Qty Instead]    │
└──────────────────────────────────────────┘
```

- **Undo** — Deletes the just-created duplicate item. Shows brief confirmation: `"Removed duplicate Milk"`.
- **+1 Qty Instead** — Deletes the just-created duplicate AND increments the existing item's quantity. If the new item had a typed quantity (e.g., user entered "3 Milk"), increment by that amount instead of 1. Shows brief confirmation: `"Milk updated to ×3"`.
- **Auto-dismiss (default)** — The duplicate stays on the list. This is the safe default — the user asked to add it, so it gets added. No silent data loss.

**Design notes:**
- Extend `CategoryToastStack` with a duplicate variant rather than creating a separate component — keeps toast layout and z-index management in one place, avoids coexistence conflicts
- Uses the same spring animation, card style (`bg-card`, `shadow-lg`, `rounded-xl`), and left border accent as existing category toasts
- Auto-dismisses after 5 seconds (same ballpark as category toasts at 4s — this isn't a blocking decision, just an undo opportunity)
- Only ONE duplicate toast visible at a time (replace previous if user rapidly types duplicates)
- If a category toast and duplicate toast coexist, duplicate toast renders above category toasts (more time-sensitive)

### Scenario 3: Multiple matches
If there are multiple unchecked items with the same name (e.g., "Milk" appears twice already):
- Show the toast referencing the first match (by sort order / most visible one)
- "+1 Qty Instead" applies to that specific item
- "Undo" removes the just-created item
- Toast shows total existing count: `"Milk" is already on your list (×2, 2 entries)`

### Scenario 4: AI/NL Parse Mode (batch)
When using natural language parsing (e.g., "stuff for tacos"), the NLParseModal already shows a review screen of parsed items before creation.

**Proposed behavior:** In the NLParseModal, show a subtle duplicate indicator next to items that match existing list items:
- Small warning badge/icon next to the item name
- Subtitle text: `"Already on list (×1 in Produce)"`
- User can still confirm (creates duplicate) or uncheck the item from the parsed list
- For items matching done items: show `"In done list — will restore"` and auto-uncheck on confirm instead of creating new

No extra modal or prompt — just visual indicators within the existing review flow.

## Matching Logic

**Name matching:**
- Case-insensitive exact match: `existingItem.name.toLowerCase().trim() === newItemName.toLowerCase().trim()`
- No fuzzy/partial matching in v1 (e.g., "Milk" won't match "Whole Milk") — this avoids false positives and keeps the logic simple. Can be added later.

**Category-aware matching:**
- Match by name only, regardless of category. "Milk" in Dairy and "Milk" in Baking are both flagged. This matches user expectation — if they see the name already on their list, they'd consider it a duplicate. Edge case: if a user genuinely wants "Milk" in two categories, they can ignore the toast (duplicate stays).

**Filtered/hidden items:**
- Duplicate check searches ALL items, not just currently visible ones. If the user has "My Items" filter active and can't see an item assigned to someone else, the toast should show who it's assigned to: `"Milk" is already on your list (×2, assigned to Sarah)"`.

**Where the check runs:**
- **Frontend only** — we already have all items loaded in the React Query cache (`list.items`). No backend API changes needed.
- For single item entry: check happens in `handleSingleItem()` in `ListPage.tsx`. If duplicate found, proceed with normal creation but flag the entry for duplicate toast display.
- For AI mode: check happens when rendering `NLParseModal` items.

## Implementation Plan

### Step 1: Duplicate detection utility
Create a helper function in `ListPage.tsx` (or a small utility):
```typescript
function findDuplicateItem(items: Item[], name: string): {
  match: Item;
  isDone: boolean;
} | null
```
- Searches all items (checked and unchecked) for case-insensitive trimmed name match
- Returns the matching item and whether it's in the done state
- If matches exist in both checked and unchecked, prefer the unchecked match (since the unchecked one is the more "active" conflict)

### Step 2: Handle done-item duplicates in `handleSingleItem()`
Before entering the async categorize+create flow:
1. Check for duplicate
2. If match is checked (done): call `uncheckItem.mutate(match.id)` and show a toast
3. Return early (don't create a new item)

### Step 3: Extend CategoryToastStack with duplicate variant
Add a new entry status to `RecentItemEntry`:
- New status: `'duplicate'` alongside existing `'categorizing'` | `'created'`
- Additional fields on the entry: `duplicateOfItem: Item | null` (the existing item that was matched)
- Duplicate entries render with warning styling, show existing item's category/quantity/assignee, and have `[Undo]` and `[+1 Qty Instead]` action buttons
- Reuses existing toast card, animation, timer, and layout logic

### Step 4: Handle active-item duplicates in `handleSingleItem()`
1. Check for duplicate before entering the async flow
2. If match is unchecked (active): proceed with normal fire-and-forget creation
3. After item is created successfully, update the entry status to `'duplicate'` instead of `'created'`
4. On "Undo": call `deleteItem.mutate(newItemId)`, remove toast
5. On "+1 Qty Instead": call `deleteItem.mutate(newItemId)` AND `updateItem.mutate({ id: existingItem.id, data: { quantity: existingItem.quantity + addedQuantity } })`, remove toast
6. On auto-dismiss: do nothing — duplicate stays (safe default)

### Step 5: NLParseModal duplicate indicators
- When rendering parsed items in NLParseModal, cross-reference against `list.items`
- Add visual indicator (warning icon + subtitle) for matches
- Done-item matches: auto-handle on confirm (uncheck existing instead of creating new)
- Active-item matches: show indicator but let user decide (they can uncheck the item from the parsed list)

### Step 6: Edge cases
- **Shared lists / SSE updates**: If another user adds the same item between when our user starts typing and submits, the duplicate check uses the latest cache data, which SSE keeps fresh. This is good enough.
- **Offline**: If offline, we still have cached items to check against. Works fine.
- **Rapid adds**: If user types "Milk" and hits enter twice quickly, the first creates the item, the second should catch the duplicate. Since the first add updates the cache optimistically via `onSuccess`, the second check will see it.
- **Filtered items**: Duplicate check searches all items regardless of active filters. Toast shows assignee context when the existing item is assigned to someone else.
- **Undo race condition**: If the user taps "Undo" but the item creation hasn't completed yet (still in categorize+create flow), the undo should wait for creation to finish before deleting. Track the `createdItemId` — if null, queue the undo to fire after creation completes.

## Files to Create/Modify

| File | Change |
|------|--------|
| `frontend/src/pages/ListPage.tsx` | Add duplicate detection in `handleSingleItem()`, pass duplicate info to toast entries |
| `frontend/src/components/items/CategoryToastStack.tsx` | Extend `RecentItemEntry` with duplicate variant, add undo/+1 qty buttons for duplicate entries |
| `frontend/src/components/items/NLParseModal.tsx` | Add duplicate indicators to parsed items |

**No backend changes required.** All detection is client-side using already-loaded item data.

## UX Summary

| Scenario | Action | User Effort | Default (ignore toast) |
|----------|--------|-------------|----------------------|
| Adding item that's in Done list | Auto-restore + toast notification | Zero — automatic | Item restored |
| Adding item that's already active | Create item + show correction toast | One tap to undo or merge qty | Duplicate stays (safe) |
| AI parse with existing items | Visual indicator in review modal | Can uncheck before confirming | Duplicate created |

The key principle: **create first, correct after**. The input always clears immediately. Items are always created. Duplicate resolution is an undo opportunity, not a gate. The user is never stuck waiting, and ignoring a toast never causes silent data loss.
