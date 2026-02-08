# /add-tasks

Parse the current conversation for actionable items and add them to FamilyList.

## Steps

1. Review the conversation for actionable items, deadlines, and implied assignments
2. Call `get_lists` to find the target task list
3. Call `lookup_users` to resolve any mentioned people to user IDs
4. Call `get_categories` for the target list to find appropriate category IDs
5. For each actionable item, determine:
   - `name` — clear, actionable task name (start with a verb: "Call...", "Schedule...", "Research...")
   - `notes` — relevant context from conversation (phone numbers, amounts, links, details)
   - `category_id` — best matching category from the list
   - `priority` — based on urgency and deadline
   - `magnitude` — estimate effort level (S/M/L)
   - `due_date` — if a deadline is mentioned or implied
   - `assigned_to` — based on assignment guidelines in family-context.md
6. Call `create_items` with batch data (all items in one call)
7. Summarize what was added: task names, assignments, due dates, and which list they were added to
