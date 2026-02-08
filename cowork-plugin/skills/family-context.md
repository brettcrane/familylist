# Family Context

## Resolving People to User IDs

Always use the `lookup_users` tool with a name query to resolve people to their
user IDs before assigning tasks. Never hardcode user IDs.

Example: to assign a task to Brett, first call `lookup_users` with `?name=Brett`
to get his user ID, then use that ID in the `assigned_to` field.

## Assignment Guidelines

When creating tasks from conversation, use these defaults for who to assign:

- **Brett** — financial, legal, condo board, insurance, car, work, tech, personal health
- **Aly** — kids activities, pediatric appointments, birthday planning, school, vet
- **Unassigned** — joint decisions, house search, items needing discussion, unclear ownership

When in doubt, leave unassigned and add a note suggesting who might handle it.

## Existing Lists

Always call `get_lists` before creating new lists. The family maintains ongoing
lists — prefer adding items to existing task lists over creating new ones.
