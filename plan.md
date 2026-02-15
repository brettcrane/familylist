# Plan: Handle Duplicate Items on Add

## Problem

When a user adds an item that already exists on the list, nothing prevents a duplicate from being created. The user has no awareness of existing items that match what they're typing. This leads to confusion — especially on shared lists where someone else may have already added the item.

## Scenarios to Handle

### Scenario 1: Duplicate exists in Done (checked) items
**User intent:** "I need this again" — they almost certainly want it back on the active list.

**Proposed behavior:** Auto-uncheck the existing item (move it back to To Do) and show a brief toast: `"Milk moved back to your list"`. No prompt needed — this is the obvious action. If there are multiple checked matches, uncheck the most recently checked one.

**Quantity handling:** Keep the existing item's quantity as-is. If the user typed a quantity (e.g., they type "Milk" and the done item has quantity=2), preserve the quantity=2 since that was their last known desired amount.

### Scenario 2: Duplicate exists in active (unchecked) items
**User intent:** Ambiguous — could be:
- They want more of it (increment quantity)
- They didn't realize it was already there (want to cancel)
- They genuinely want a separate entry (rare, but possible)

**Proposed behavior:** Show a **duplicate resolution toast** (similar in style to the existing CategoryToast) that appears inline above the input bar. This is non-blocking — the input clears immediately so the experience feels fast.

**Toast content:**
```
┌──────────────────────────────────────────┐
│  ⚠  "Milk" is already on your list      │
│     ×2 in Dairy                          │
│                                          │
│  [+1 Qty]    [Add Anyway]    [Dismiss]   │
└──────────────────────────────────────────┘
```

- **+1 Qty** — Increments the existing item's quantity by 1 (or by the new item's quantity if specified). Shows a brief confirmation toast: `"Milk updated to ×3"`.
- **Add Anyway** — Creates a new separate item (proceeds with normal fire-and-forget flow including AI categorization).
- **Dismiss** — Cancels the add entirely. No item created.

**Design notes:**
- Toast uses the same spring animation and styling as CategoryToastStack
- Shows the existing item's category and current quantity for context
- Auto-dismisses after ~8 seconds (longer than category toasts since it requires a decision) — default action on auto-dismiss is **Dismiss** (don't add), since the user was warned
- Only ONE duplicate toast at a time (replace previous if user rapidly types duplicates)

### Scenario 3: Multiple matches
If there are multiple unchecked items with the same name (e.g., "Milk" appears twice already):
- Show the toast for the first match (by sort order / most visible one)
- "+1 Qty" applies to that specific item
- "Add Anyway" creates yet another entry

### Scenario 4: AI/NL Parse Mode (batch)
When using natural language parsing (e.g., "stuff for tacos"), the NLParseModal already shows a review screen of parsed items before creation.

**Proposed behavior:** In the NLParseModal, show a subtle duplicate indicator next to items that match existing list items:
- Small warning badge/icon next to the item name
- Tooltip or subtitle text: `"Already on list (×1 in Produce)"`
- User can still confirm (creates duplicate) or remove the item from the parsed list
- For items matching done items: show `"In done list — will restore"` and auto-uncheck on confirm

No extra modal or prompt — just visual indicators within the existing review flow.

## Matching Logic

**Name matching:**
- Case-insensitive exact match: `existingItem.name.toLowerCase() === newItemName.toLowerCase()`
- Trim whitespace on both sides
- No fuzzy/partial matching in v1 (e.g., "Milk" won't match "Whole Milk") — this avoids false positives and keeps the logic simple. Can be added later.

**Where the check runs:**
- **Frontend only** — we already have all items loaded in the React Query cache (`list.items`). No backend API changes needed.
- Check happens in `handleSingleItem()` in `ListPage.tsx` before entering the fire-and-forget flow.
- For AI mode, check happens when rendering `NLParseModal` items.

## Implementation Plan

### Step 1: Duplicate detection utility
Create a helper function in `ListPage.tsx` (or a small utility):
```typescript
function findDuplicateItem(items: Item[], name: string): {
  match: Item;
  isDone: boolean;
} | null
```
- Searches all items (checked and unchecked) for case-insensitive name match
- Returns the matching item and whether it's in the done state
- If matches exist in both checked and unchecked, prefer the unchecked match (since the unchecked one is the more "active" conflict)

### Step 2: Handle done-item duplicates in `handleSingleItem()`
Before entering the async categorize+create flow:
1. Check for duplicate
2. If match is checked (done): call `uncheckItem.mutate(match.id)` and show a toast
3. Return early (don't create a new item)

### Step 3: DuplicateItemToast component
New component similar to `CategoryToastStack` but for duplicate resolution:
- Renders above the input bar (same area as category toasts)
- Shows item name, existing quantity, category
- Three action buttons: +1 Qty, Add Anyway, Dismiss
- Spring animation matching existing toast patterns
- Auto-dismiss behavior (defaults to Dismiss/cancel)

### Step 4: Handle active-item duplicates in `handleSingleItem()`
Before entering the async categorize+create flow:
1. Check for duplicate
2. If match is unchecked (active): show DuplicateItemToast
3. Pause the creation flow until user chooses an action
4. On "+1 Qty": call `updateItem.mutate({ id: match.id, data: { quantity: match.quantity + 1 } })`
5. On "Add Anyway": proceed with normal `handleSingleItem` flow
6. On "Dismiss": do nothing (input already cleared)

### Step 5: NLParseModal duplicate indicators
- When rendering parsed items in NLParseModal, cross-reference against `list.items`
- Add visual indicator (warning icon + subtitle) for matches
- Done-item matches: auto-handle on confirm (uncheck existing instead of creating new)
- Active-item matches: show indicator but let user decide (they can remove the item from the list)

### Step 6: Edge cases
- **Shared lists / SSE updates**: If another user adds the same item between when our user starts typing and submits, the duplicate check uses the latest cache data, which SSE keeps fresh. This is good enough.
- **Offline**: If offline, we still have cached items to check against. Works fine.
- **Rapid adds**: If user types "Milk" and hits enter twice quickly, the first creates the item, the second should catch the duplicate. Since the first add updates the cache optimistically via `onSuccess`, the second check will see it.

## Files to Create/Modify

| File | Change |
|------|--------|
| `frontend/src/pages/ListPage.tsx` | Add duplicate detection in `handleSingleItem()`, manage DuplicateToast state |
| `frontend/src/components/items/DuplicateItemToast.tsx` | **New** — duplicate resolution toast component |
| `frontend/src/components/items/NLParseModal.tsx` | Add duplicate indicators to parsed items |
| `frontend/src/components/items/index.ts` | Export new component (if barrel file exists) |

**No backend changes required.** All detection is client-side using already-loaded item data.

## UX Summary

| Scenario | Action | User Effort |
|----------|--------|-------------|
| Adding item that's in Done list | Auto-restore + toast notification | Zero — automatic |
| Adding item that's already active | Show resolution toast with options | One tap (or ignore to cancel) |
| AI parse with existing items | Visual indicator in review modal | Can remove before confirming |

The key principle: **inform without blocking**. The input always clears immediately. Duplicate resolution happens via non-blocking toasts, not modals. The user is never stuck waiting.
