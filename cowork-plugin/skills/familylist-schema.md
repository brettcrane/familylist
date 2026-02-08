# FamilyList Schema

## List Types
- **grocery** — Shopping lists with categories like Produce, Dairy, Meat, etc.
- **packing** — Travel packing lists with Clothing, Toiletries, Electronics, etc.
- **tasks** — Task/todo lists with custom categories (Health, Home, Finance, Family, Work)

## Item Fields (all items)
- `name` (required) — Item name
- `quantity` (default: 1) — How many
- `notes` — Free-text notes, links, details
- `category_id` — Category within the list (use `get_categories` to find IDs)
- `magnitude` — Effort sizing: S (quick, <10min), M (10-60min), L (1+ hours)
- `assigned_to` — User ID of assignee (use `lookup_users` to resolve names to IDs)

## Task-Only Fields
- `priority` — urgent, high, medium, low
- `due_date` — ISO date string (YYYY-MM-DD)
- `status` — open, in_progress, done, blocked
- `created_by` — User ID of creator (set automatically for MCP-created items)

## Priority Guidelines
- **urgent** — This week, blocking, safety/legal implications
- **high** — Next 2 weeks, important but not crisis
- **medium** — This month
- **low** — Ongoing/background

## Magnitude (Effort Sizing)
- **S** = Quick (<10 min) — send an email, make a call
- **M** = Medium (10-60 min) — research a topic, fill out forms
- **L** = Large (1+ hours) — estate planning, house tours

## How to Create Items
1. Call `get_lists` to find existing lists
2. Call `get_categories` for the target list to get category IDs
3. Call `lookup_users` to resolve people's names to user IDs (for `assigned_to`)
4. Call `create_items` with the list ID, item data, and optional task fields
5. For task items, set priority, magnitude, due_date, and assigned_to as appropriate

## How to Query Items
- `get_items` with `?status=open,in_progress` — active tasks
- `get_items` with `?priority=urgent,high` — high-priority items
- `get_items` with `?due_before=YYYY-MM-DD` — items due before a date
- `get_items` with `?assigned_to=USER_ID` — items assigned to someone
- Filters can be combined: `?status=open&priority=urgent,high&due_before=2026-03-01`

## Categories for Tasks
Default task categories: Health, Home, Finance, Family, Work.
New categories can be created via `create_category`.
