# FamilyList Schema

## List Types
- **grocery** — Shopping lists with categories like Produce, Dairy, Meat, etc.
- **packing** — Travel packing lists with Clothing, Toiletries, Electronics, etc.
- **tasks** — Task/todo lists with custom categories (Health, Home, Finance, Family, Work)

## Item Fields (all items)
- `name` (required) — Item name
- `quantity` (default: 1) — How many
- `unit` — Unit of measure (cup, tbsp, oz, etc.)
- `notes` — Free-text notes, links, details
- `category_id` — Category within the list (use `get_categories` to find IDs)
- `magnitude` — Effort sizing: S (quick, <10min), M (10-60min), L (1+ hours)
- `assigned_to` — User ID of assignee (use `lookup_users` to resolve names to IDs)

## Task-Only Fields
- `priority` — urgent, high, medium, low
- `due_date` — ISO date string (YYYY-MM-DD)
- `status` — open, in_progress, done, blocked (default to `open` for new tasks)

## Read-Only Fields
- `created_by` — User ID of creator. Set automatically from the authenticated user; cannot be set in create/update requests.
- `created_by_name` — Display name of creator (resolved automatically).

## Priority Guidelines
- **urgent** — This week, blocking, safety/legal implications
- **high** — Next 2 weeks, important but not crisis
- **medium** — This month
- **low** — Ongoing/background

## Magnitude (Effort Sizing)
- **S** = Quick (<10 min) — send an email, make a call
- **M** = Medium (10-60 min) — research a topic, fill out forms
- **L** = Large (1+ hours) — estate planning, house tours

## Reading Data — Use `query_sql`

**Always use `query_sql` for reading data.** It returns only the columns you need and is far more efficient than `get_items` or `get_lists`. See `efficient-queries.md` for the schema and common patterns.

The only exceptions: use `get_categories` and `lookup_users` directly — they return small payloads.

## Writing Data — Use MCP Tools

### Creating Items
1. Call `get_categories` for the target list to get category IDs
2. Call `lookup_users` to resolve people's names to user IDs (for `assigned_to`)
3. Call `create_items` with the list ID, item data, and optional task fields

### Updating and Completing Items
- `update_item` — Change name, notes, priority, status, due_date, assigned_to, etc.
- `check_item` — Mark an item as done (also sets status to "done" for task items)
- `uncheck_item` — Mark an item as not done (resets status to "open" for task items)
- `delete_item` — Permanently remove an item

## Categories for Tasks
Default task categories: Health, Home, Finance, Family, Work.
New categories can be created via `create_category`.
