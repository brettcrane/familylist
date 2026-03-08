# /weekly-digest

Generate a weekly summary of open tasks from FamilyList.

## Steps

1. Get all task lists:
   ```sql
   SELECT id, name FROM lists WHERE type = 'tasks' AND is_template = 0
   ```

2. For each task list, get overdue and upcoming items in one query:
   ```sql
   SELECT i.id, i.name, i.priority, i.due_date, i.status, i.magnitude,
          u.display_name AS assigned_to_name, c.name AS category
   FROM items i
   LEFT JOIN users u ON i.assigned_to = u.id
   LEFT JOIN categories c ON i.category_id = c.id
   WHERE i.list_id = '<LIST_ID>' AND i.is_checked = 0
     AND (i.priority IN ('urgent', 'high') OR i.due_date <= date('now', '+7 days'))
   ORDER BY i.due_date, i.priority
   ```

3. Group items into:
   - **Overdue** — due_date is before today
   - **Due this week** — due_date within the next 7 days
   - **Urgent/High priority** — priority is urgent or high, regardless of due date
   - **Blocked** — status is 'blocked'

4. Get a per-person breakdown:
   ```sql
   SELECT u.display_name, COUNT(*) AS open_tasks,
          SUM(CASE WHEN i.due_date < date('now') THEN 1 ELSE 0 END) AS overdue
   FROM items i
   LEFT JOIN users u ON i.assigned_to = u.id
   WHERE i.list_id = '<LIST_ID>' AND i.is_checked = 0
   GROUP BY i.assigned_to
   ```

5. Present as a structured summary:
   - Lead with overdue items (these need immediate attention)
   - Then this week's deadlines
   - Then high-priority items without due dates
   - Then a per-person breakdown
6. Flag any blocked items that may need discussion
7. Suggest focus areas for the week based on priority and deadlines
