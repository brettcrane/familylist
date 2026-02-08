# Claude Cowork + FamilyList: Full Integration Plan

*Researched 2026-02-08*

## Executive Summary

Claude Cowork is Anthropic's agentic desktop assistant (launched Jan 2026) with MCP connector support and a plugin system. The goal is to make FamilyList the **single destination for all task/life management output** from Cowork sessions — when Brett and Claude discuss tasks, insurance renewals, or family logistics in Cowork, the resulting action items flow directly into FamilyList where both Brett and Aly can see and act on them.

This requires two parallel workstreams:
1. **FamilyList app enhancements** — Add priority, due dates, status, and created_by tracking to make FamilyList a proper task management tool (not just a list app)
2. **MCP integration** — Expose FamilyList as an MCP server so Cowork can read/write directly, plus build a Cowork plugin with domain knowledge

These are not "partial" steps — they're both required for the full workflow to work.

---

## Part 1: Are New Fields Overhead or Natural Enhancements?

**Short answer: Natural enhancements for task lists, zero impact on grocery/packing.**

All new fields are **nullable/optional on the existing Item model**. The frontend shows them **conditionally based on `list.type`**. Grocery and packing lists are completely unaffected.

| Field | Tasks | Grocery | Packing | Overhead? |
|-------|-------|---------|---------|-----------|
| `priority` (urgent/high/medium/low) | Core feature | Hidden | Hidden | No — you'd want this for any task list |
| `due_date` | Core feature | Hidden | Hidden | No — deadlines are fundamental to tasks |
| `status` (open/in_progress/done/blocked) | Replaces binary checked | Stays as checked | Stays as checked | No — richer than is_checked for tasks |
| `created_by` | Useful everywhere | Useful everywhere | Useful everywhere | No — good for all shared lists ("who added this?") |

**Bottom line**: These make FamilyList a **real task manager** instead of just a checklist. The Cowork integration is the catalyst, but the features stand on their own. Even without Cowork, you'd want priority and due dates on a task list.

**Notes field**: The existing `notes` field already covers what the Cowork handoff calls "description" — longer context, phone numbers, links, coverage details. No need for a separate description field.

---

## Part 2: Claude Cowork — What It Is and How It Integrates

### What Cowork Does
- Agentic task execution in the Claude Desktop app (macOS; Windows planned)
- Same agentic loop as Claude Code: Observe → Plan → Act → Reflect
- Decomposes complex tasks, spawns 3-5 sub-agents in parallel
- Has filesystem access (read/write local files) and shell access (allowlisted commands)
- Available on Pro ($20/mo), Max 5x ($100/mo), Max 20x ($200/mo) — identical features, different usage limits
- `curl`/`wget` are **blocked by default** — Cowork uses MCP connectors for network access

### Plugin Architecture
Cowork supports plugins ([github.com/anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins)):

```
familylist-plugin/
├── .claude-plugin/
│   └── plugin.json          # Manifest
├── .mcp.json                # MCP server connection to FamilyList API
├── commands/                 # Slash commands (user-invoked)
│   ├── add-tasks.md         # /add-tasks
│   ├── weekly-digest.md     # /weekly-digest
│   └── sync-tasks.md        # /sync-tasks
└── skills/                   # Domain knowledge (auto-drawn by Claude)
    ├── familylist-schema.md  # List types, item fields, categories
    └── family-context.md     # Brett/Aly identity mapping
```

- **Skills** = markdown files with domain expertise. Claude draws on them automatically when relevant.
- **Commands** = explicit slash commands the user invokes.
- **`.mcp.json`** = connection config to the FamilyList MCP server.

### MCP (Model Context Protocol)
MCP is the standard for connecting AI to external tools. An MCP server exposes **tools** (functions Claude can call) via HTTP.

For FamilyList:
- Add an MCP endpoint (`/mcp`) to the existing FastAPI app
- Cowork connects via HTTPS with API key auth
- Claude can then call tools like `create_list`, `add_items`, `get_items`, etc.

---

## Part 3: Full Implementation Plan

### A. Backend Schema Enhancements

#### A1. New Item Fields

Add to `Item` model and `ItemCreate`/`ItemUpdate`/`ItemResponse` schemas:

```python
# models.py — Item model additions
priority = Column(String, nullable=True)  # urgent, high, medium, low
due_date = Column(Date, nullable=True)
status = Column(String, nullable=True, default="open")  # open, in_progress, done, blocked
created_by = Column(String, ForeignKey("users.id"), nullable=True)

# CheckConstraints
CheckConstraint("priority IN ('urgent', 'high', 'medium', 'low') OR priority IS NULL")
CheckConstraint("status IN ('open', 'in_progress', 'done', 'blocked') OR status IS NULL")
```

```python
# schemas.py additions
class Priority(str, Enum):
    URGENT = "urgent"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class ItemStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    BLOCKED = "blocked"

# ItemCreate additions
priority: Priority | None = None
due_date: date | None = None
status: ItemStatus | None = None
```

**Backward compatibility**: All fields are nullable with no defaults that change behavior. `is_checked` stays as-is for grocery/packing — the `status` field is an _additional_ field for tasks. Existing API consumers see no change.

**`status` vs `is_checked` relationship**: For task lists, `status` is the primary field. When a task item is marked "done" via status, the backend should also set `is_checked=True` for consistency with existing views. When `is_checked` is toggled on a task item, update `status` to "done"/"open" accordingly. For grocery/packing, `is_checked` continues to work as-is and `status` stays null.

**Migration strategy**: Alembic migration adds nullable columns. No data migration needed — existing items get NULL for all new fields.

#### A2. Claude System User

Create a system user for tracking Claude-created items:

```python
# In a migration or seed script
claude_user = User(
    id="claude-system-user",
    clerk_user_id="claude-system",
    display_name="Claude",
    email="claude@system.local",
    avatar_url=None,
)
```

When items are created via MCP (API key auth), set `created_by` to this user's ID. The frontend can show a Claude icon/badge for items Claude created.

#### A3. Serializer Updates

Update `item_to_response()` in `serializers.py`:
```python
{
    ...existing fields...
    "priority": item.priority,
    "due_date": item.due_date.isoformat() if item.due_date else None,
    "status": item.status,
    "created_by": item.created_by,
    "created_by_name": item.created_by_user.display_name if item.created_by_user else None,
}
```

#### A4. API Enhancements

**Item filtering** — Extend `GET /api/lists/{list_id}/items`:
```
?status=open,in_progress    # Filter by status
?priority=urgent,high        # Filter by priority
?due_before=2026-03-01       # Due date filtering
?assigned_to=user-id         # Filter by assignee
?created_by=claude-system    # Filter by creator
```

### B. MCP Server Integration

#### B1. Add MCP Endpoint to FamilyList Backend

Using `fastapi-mcp` library for quick setup:

```bash
cd backend && uv add fastapi-mcp
```

```python
# backend/app/mcp_server.py
from fastapi_mcp import FastApiMCP

def setup_mcp(app):
    mcp = FastApiMCP(
        app,
        name="familylist",
        description="Family list and task management with AI categorization",
        describe_all_responses=True,
    )
    mcp.mount()  # Adds /mcp endpoint
```

```python
# backend/app/main.py — add after router includes
from app.mcp_server import setup_mcp
setup_mcp(app)
```

**Auth**: The MCP endpoint inherits FamilyList's existing auth. Cowork sends the API key as `authorization_token`, which arrives as a Bearer token. We may need a small adapter to accept it as either `X-API-Key` or `Authorization: Bearer` (the existing hybrid auth may handle this already — it checks for Bearer tokens first, then falls back to API key).

**Note on PR #22**: The read-only offline mode changes (service worker GET caching, query persistence) do not affect MCP integration. MCP writes go through the REST API directly, and SSE `item_created`/`item_updated` events trigger React Query cache invalidation, so Claude-created items appear in real-time on all connected clients.

#### B2. Custom MCP Tools (Optional Enhancement)

If auto-generated tool descriptions aren't ideal for Claude, add custom high-level tools:

```python
@mcp.tool()
def create_task_list_with_items(
    list_name: str,
    items: list[dict],  # [{name, category, priority, magnitude, due_date, assigned_to_name, notes}]
) -> dict:
    """Create a new task list and populate with items.
    assigned_to_name: 'Brett' or 'Aly' — resolved to user IDs.
    Returns the created list with all items."""
    ...

@mcp.tool()
def get_weekly_summary() -> dict:
    """Get all open/in_progress items due this week or overdue, grouped by assignee and priority."""
    ...

@mcp.tool()
def bulk_update_items(updates: list[dict]) -> dict:
    """Update multiple items at once. Each dict: {item_id, priority?, status?, assigned_to_name?, due_date?}"""
    ...
```

#### B3. Identity Resolution

The MCP tools need to resolve names like "Brett" and "Aly" to user IDs. Two options:

**Option A: Skill-based mapping** (simpler) — The Cowork plugin skill file contains the mapping, and Claude passes user IDs directly:
```markdown
# In skills/family-context.md
Brett Crane's user ID: <uuid>
Aly Crane's user ID: <uuid>
```

**Option B: API-based resolution** (more robust) — Add a user lookup tool:
```
GET /api/users/lookup?name=Brett  →  { id, display_name, email }
```
Claude calls this to resolve names dynamically. Better for if users change.

**Recommendation**: Start with Option A (hardcoded in skill), add Option B later.

### C. Cowork Plugin

#### C1. Plugin Manifest

```json
// .claude-plugin/plugin.json
{
  "name": "familylist",
  "display_name": "FamilyList",
  "description": "Manage family tasks, grocery lists, and packing lists",
  "version": "1.0.0",
  "author": "Brett Crane"
}
```

#### C2. MCP Connection

```json
// .mcp.json
{
  "mcpServers": {
    "familylist": {
      "url": "https://familylist.yourdomain.com/mcp",
      "transport": "streamable-http",
      "authorization_token": "${FAMILYLIST_API_KEY}"
    }
  }
}
```

#### C3. Skills

```markdown
// skills/familylist-schema.md
# FamilyList Schema

## List Types
- **grocery** — Shopping lists. Categories: Produce, Dairy, Meat, etc.
- **packing** — Travel/trip packing lists. Categories: Clothing, Toiletries, etc.
- **tasks** — Todo/task lists. Categories: Health, Home, Finance, Legal, Family, Work, etc.

## Item Fields
All items have: name (required), quantity, notes, category_id, magnitude (S/M/L), assigned_to

Task items additionally use: priority (urgent/high/medium/low), due_date, status (open/in_progress/done/blocked)

## Magnitude (Effort Sizing)
- S = Quick (<10 min) — e.g., send an email, make a call
- M = Medium (10-60 min) — e.g., research a topic, fill out forms
- L = Large (1+ hours) — e.g., estate planning appointment, house tours

## Priority
- urgent = This week, blocking, safety/legal implications
- high = Next 2 weeks, important but not crisis
- medium = This month
- low = Ongoing/background

## Categories for Tasks
Health, Home, Dog, Family, Finance, Work, Condo Board, House Search, Legal, Car
(New categories can be created via the API)

## How to Create Items
1. Use GET lists to find or identify the target list
2. Use POST items with batch creation for multiple items
3. Set magnitude, priority, due_date, and assigned_to as appropriate
4. Claude-created items should be identifiable (created_by field)
```

```markdown
// skills/family-context.md
# Crane Family Context

## People
- **Brett Crane** — User ID: <uuid>. VP of Sales, 41. Handles: finances, insurance, condo board, his own health items, car, work.
- **Aly Crane** — User ID: <uuid>. Handles: kids activities, pediatric appointments, birthday planning, school communications.
- Both handle: house search, life insurance, shared family decisions.

## Assignment Guidelines
When creating tasks from conversation:
- Default to Brett for: financial, legal, condo board, personal health, car, work items
- Default to Aly for: kids scheduling, birthday parties, pediatric dentist, school items, vet appointments
- Mark as unassigned for: items needing discussion, joint decisions (house search)

## Existing Lists
Check current lists before creating new ones. The family likely has ongoing task lists.
```

#### C4. Commands

```markdown
// commands/add-tasks.md
# /add-tasks

Parse the current conversation into structured tasks and add them to FamilyList.

## Steps
1. Review the conversation for actionable items, deadlines, and assignments
2. GET existing lists to find the right target list (or create one)
3. For each task, determine: name, notes, category, priority, magnitude, due_date, assigned_to
4. Batch-create items via the FamilyList MCP tools
5. Summarize what was added: list name, item count, assignments
```

```markdown
// commands/weekly-digest.md
# /weekly-digest

Generate a weekly summary of open tasks from FamilyList.

## Steps
1. GET all task-type lists
2. GET items filtered by status=open,in_progress
3. Group by: overdue, due this week, high/urgent priority, by assignee
4. Present as a structured summary with recommended focus areas
```

### D. Frontend Enhancements

#### D1. Task-Specific Item Fields (conditional rendering)

In `EditItemModal.tsx`, show additional fields when `list.type === "tasks"`:

```tsx
{list.type === "tasks" && (
  <>
    <PriorityDropdown value={priority} onChange={setPriority} />
    <DueDatePicker value={dueDate} onChange={setDueDate} />
    <StatusDropdown value={status} onChange={setStatus} />
  </>
)}
```

#### D2. Priority Display in ItemRow

For task lists, show priority as a color-coded indicator:

```typescript
// types/api.ts
export const PRIORITY_CONFIG = {
  urgent: { label: "Urgent", color: "text-red-600", bg: "bg-red-100", sortOrder: 0 },
  high:   { label: "High",   color: "text-orange-600", bg: "bg-orange-100", sortOrder: 1 },
  medium: { label: "Medium", color: "text-yellow-600", bg: "bg-yellow-100", sortOrder: 2 },
  low:    { label: "Low",    color: "text-green-600", bg: "bg-green-100", sortOrder: 3 },
} as const;
```

#### D3. Due Date Display

Show due date badge on `ItemRow` for task lists. Overdue items get red styling.

#### D4. "Created by Claude" Badge

Small AI indicator on items where `created_by` is the Claude system user. Helps Brett and Aly distinguish between human-created and AI-created tasks.

#### D5. "Focus View" (Today/This Week)

Optional filtered landing view showing only:
- Overdue items
- Due this week
- Urgent/high priority
- Assigned to current user

This is a frontend filter on existing data — no new backend endpoints needed beyond the enhanced filtering in A4.

---

## Part 4: Implementation Sequence

Ordered by dependency:

### Step 1: Backend Schema + Migration
- Add all new fields to Item model (priority, due_date, status, created_by)
- Add Priority and ItemStatus enums to schemas
- Update ItemCreate, ItemUpdate, ItemResponse schemas
- Update item_to_response() serializer
- Implement status ↔ is_checked sync logic for task items
- Create Claude system user
- Run Alembic migration
- Update existing tests

### Step 2: API Enhancements
- Add query parameter filtering (priority, status, due_date, created_by)
- Add user lookup endpoint
- Update batch create to support new fields

### Step 3: MCP Server
- Add fastapi-mcp dependency
- Mount MCP endpoint
- Test with MCP Inspector
- Verify auth works with API key as authorization_token
- Consider custom high-level tools if auto-generated ones aren't clear enough

### Step 4: Frontend — Task Fields
- Add priority dropdown, due date picker, status dropdown to EditItemModal (tasks only)
- Add priority badge and due date display to ItemRow (tasks only)
- Add "Created by Claude" indicator
- Add PRIORITY_CONFIG and STATUS_CONFIG to types/api.ts

### Step 5: Cowork Plugin
- Create plugin directory structure
- Write .mcp.json connection config
- Write skills (schema + family context)
- Write commands (add-tasks, weekly-digest)
- Test end-to-end: Cowork → plugin → MCP → FamilyList → items appear in app

### Step 6: Polish & Test
- End-to-end testing with real Cowork sessions
- Verify push notifications fire for Claude-created items
- Verify SSE real-time updates show Claude activity
- Test assignment validation for Claude-created items

---

## Part 5: Security Considerations

- **API key scope**: Claude's API key gives full write access to all lists. Acceptable for a private family app.
- **HTTPS required**: Already handled by Caddy + Cloudflare Tunnel.
- **No sensitive data exposure**: MCP tools shouldn't return Clerk tokens, VAPID keys, or system internals.
- **Rate limiting**: Consider adding rate limits to `/mcp` endpoint to prevent runaway agents.
- **Audit trail**: `created_by` field tracks who created what. Claude-created items are identifiable.
- **Plugin secret storage**: API key stored as env var in plugin config (`${FAMILYLIST_API_KEY}`), not hardcoded.

---

## Part 6: End-to-End Flow

```
Brett in Cowork: "I just got our condo insurance renewal from Amica.
                  It's due July 30, $901/year. We should review it
                  in June to compare quotes."

Claude (with FamilyList plugin):
  1. Draws on skills/family-context.md → knows Brett handles insurance
  2. Calls FamilyList MCP tool: GET lists → finds "Life Tasks" list
  3. Calls FamilyList MCP tool: POST items →
     {
       name: "Review Amica condo insurance renewal",
       notes: "Current: $901/year, due Jul 30. Compare quotes before renewal.",
       category: "Finance",
       priority: "medium",
       magnitude: "M",
       due_date: "2026-06-15",
       assigned_to: "<brett-uuid>",
       created_by: "<claude-uuid>"
     }
  4. Responds: "Added to your Life Tasks list — 'Review Amica condo insurance
     renewal', assigned to you, due June 15. I set it as medium priority with
     enough lead time before the July 30 renewal."

Aly opens FamilyList on her phone:
  → Sees the new item with Claude badge
  → Can reassign to herself, change priority, or add notes

Brett checks his "This Week" view:
  → Item shows up when June 15 approaches
  → Priority color-coding helps him focus
```

---

## Part 7: Architecture Diagram

```
┌──────────────────────────┐
│  Claude Cowork           │
│  (macOS Desktop App)     │
│                          │
│  ┌────────────────────┐  │         HTTPS + API Key
│  │ FamilyList Plugin  │  │    ┌───────────────────────┐
│  │                    │  │    │                       │
│  │ .mcp.json ─────────┼──┼───→  FamilyList Backend   │
│  │                    │  │    │  (FastAPI + Docker)   │
│  │ skills/            │  │    │                       │
│  │  familylist-schema │  │    │  /mcp ← MCP endpoint  │
│  │  family-context    │  │    │     ↓                 │
│  │                    │  │    │  /api/* ← REST API    │
│  │ commands/          │  │    │     ↓                 │
│  │  /add-tasks        │  │    │  SQLite DB            │
│  │  /weekly-digest    │  │    │     ↓                 │
│  └────────────────────┘  │    │  SSE + Push Notifs ───┼──→ Aly's phone
│                          │    │                       │    Brett's phone
│  Brett: "add insurance   │    └───────────────────────┘
│  review task"            │
│                          │
│  Claude: *calls MCP tool*│
│  → "Added to Life Tasks" │
└──────────────────────────┘
```

---

## Sources

- [Anthropic knowledge-work-plugins (GitHub)](https://github.com/anthropics/knowledge-work-plugins)
- [Getting started with Cowork (Claude Help Center)](https://support.claude.com/en/articles/13345190-getting-started-with-cowork)
- [Claude Cowork Architecture Overview (Tensorlake)](https://www.tensorlake.ai/blog/claude-cowork-architecture-overview)
- [Anthropic brings plugins to Cowork (The New Stack)](https://thenewstack.io/anthropic-brings-plugins-to-cowork/)
- [Anthropic brings agentic plug-ins to Cowork (TechCrunch)](https://techcrunch.com/2026/01/30/anthropic-brings-agentic-plugins-to-cowork/)
- [MCP Connector (Anthropic API Docs)](https://platform.claude.com/docs/en/agents-and-tools/tool-use/mcp-connector)
- [MCP Best Practices (Docker)](https://www.docker.com/blog/mcp-server-best-practices/)
- [15 Best Practices for MCP in Production (The New Stack)](https://thenewstack.io/15-best-practices-for-building-mcp-servers-in-production/)
- [FastAPI-MCP Auth (CodeSignal)](https://codesignal.com/learn/courses/advanced-mcp-server-and-agent-integration-in-python/lessons/securing-your-mcp-server-with-api-key-authentication-in-fastapi)
- [FastMCP Bearer Token Auth (Medium)](https://gyliu513.medium.com/fastmcp-bearer-token-authentication-a-technical-deep-dive-c05d0c5087f4)
- [Claude Cowork Pricing (SentiSight)](https://www.sentisight.ai/how-much-cost-claude-cowork/)
