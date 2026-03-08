# Efficient Data Access

## Rule: Use `query_sql` for reads, MCP tools for writes

- **Reading data** → Always use `query_sql` with a SQL SELECT. It returns only the columns you need, saving tokens.
- **Creating/updating/deleting** → Use the MCP tools (`create_items`, `update_item`, `check_item`, `delete_item`, etc.)
- **Never use `get_items` or `get_lists`** for reading data — they return every field on every item (~1KB per item) and can't be filtered by column.

The one exception: use `get_categories` and `lookup_users` normally — they return small payloads and you need the IDs for writes.

## Database Schema

```
users (id, clerk_user_id, display_name, email, avatar_url, created_at, updated_at)
lists (id, name, type, icon, color, owner_id→users, is_template, created_at, updated_at)
items (id, list_id→lists, category_id→categories, name, quantity, unit, notes,
       is_checked, checked_by→users, checked_at, sort_order,
       magnitude, assigned_to→users, priority, due_date, status, created_by→users,
       created_at, updated_at)
categories (id, list_id→lists, name, sort_order, created_at, updated_at)
list_shares (id, list_id→lists, user_id→users, permission, created_at)
category_learnings (id, item_name_normalized, list_type, category_name, confidence_boost, created_at, updated_at)
```

Key enums:
- `type`: grocery, packing, tasks
- `priority`: urgent, high, medium, low
- `status`: open, in_progress, done, blocked
- `magnitude`: S, M, L
- `permission`: view, edit

## Common Query Patterns

### Find all lists (replaces get_lists)
```sql
SELECT id, name, type FROM lists WHERE is_template = 0
```

### Get open tasks from a list (replaces get_items)
```sql
SELECT i.id, i.name, i.priority, i.due_date, i.status, i.magnitude, i.notes,
       u.display_name AS assigned_to_name, c.name AS category
FROM items i
LEFT JOIN users u ON i.assigned_to = u.id
LEFT JOIN categories c ON i.category_id = c.id
WHERE i.list_id = '<LIST_ID>' AND i.is_checked = 0
ORDER BY i.due_date
```

### Overdue tasks
```sql
SELECT i.id, i.name, i.priority, i.due_date, u.display_name AS assigned_to_name
FROM items i
LEFT JOIN users u ON i.assigned_to = u.id
WHERE i.list_id = '<LIST_ID>' AND i.is_checked = 0
  AND i.due_date < date('now')
ORDER BY i.due_date
```

### Tasks by person
```sql
SELECT i.id, i.name, i.priority, i.due_date, i.status
FROM items i
WHERE i.list_id = '<LIST_ID>' AND i.is_checked = 0
  AND i.assigned_to = '<USER_ID>'
ORDER BY i.priority, i.due_date
```

### Task counts by priority
```sql
SELECT priority, COUNT(*) AS count
FROM items
WHERE list_id = '<LIST_ID>' AND is_checked = 0
GROUP BY priority
```

### Recently completed items
```sql
SELECT i.name, i.checked_at, u.display_name AS checked_by_name
FROM items i
LEFT JOIN users u ON i.checked_by = u.id
WHERE i.list_id = '<LIST_ID>' AND i.is_checked = 1
ORDER BY i.checked_at DESC LIMIT 10
```

### Find items by name (fuzzy search)
```sql
SELECT id, name, is_checked, list_id FROM items
WHERE name LIKE '%keyword%' AND is_checked = 0
```

## Tips

- Always include `i.id` when you'll need to update/check items later
- Use `date('now')` for today's date in WHERE clauses
- Priority sort order: use `CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END`
- Only SELECT columns you actually need — fewer columns = fewer tokens
- Max 250 rows per query. Use LIMIT or WHERE filters for large lists
- The query endpoint is read-only. All writes must go through the MCP tools
