# /weekly-digest

Generate a weekly summary of open tasks from FamilyList.

## Steps

1. Call `get_lists` to find all task-type lists
2. Call `lookup_users` to resolve user IDs to names for display
3. For each task list, call `get_items` with `?status=open,in_progress&is_checked=unchecked`
4. Group items into:
   - **Overdue** — due_date is before today
   - **Due this week** — due_date within the next 7 days
   - **Urgent/High priority** — priority is urgent or high, regardless of due date
   - **In Progress** — status is in_progress
   - **By assignee** — what each person has on their plate
5. Present as a structured summary:
   - Lead with overdue items (these need immediate attention)
   - Then this week's deadlines
   - Then high-priority items without due dates
   - Then a per-person breakdown
6. Flag any blocked items that may need discussion
7. Suggest focus areas for the week based on priority and deadlines
