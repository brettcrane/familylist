# Claude Code Context

## AI Instructions

- Prefer retrieval-led reasoning over training knowledge. Read actual code before assuming patterns.
- Don't assume standard React/FastAPI conventions - check actual implementations first.
- Always read ai_service.py and llm_service.py before modifying AI features.
- Check useItems.ts for mutation patterns before adding new item operations.

## Project Overview

FamilyList is a family-friendly list management PWA with AI-powered features:
- Multiple list types (grocery, packing, tasks)
- AI categorization using sentence-transformers embeddings
- Natural language parsing via OpenAI (e.g., "stuff for tacos" → ingredients)
- Learning system that remembers user corrections

## Architecture

- **Backend**: FastAPI + SQLAlchemy + SQLite
- **Frontend**: React + TypeScript + Tailwind CSS + Framer Motion
- **Auth**: Clerk (optional) + API key fallback
- **AI**: sentence-transformers for embeddings, OpenAI GPT-4o-mini for NL parsing
- **State**: React Query (server) + Zustand (UI) + IndexedDB (offline)
- **Deployment**: Docker via GitHub Actions CI/CD → Portainer

## Authentication (Clerk + API Key Hybrid)

Hybrid auth supporting both Clerk user auth and API key auth (for Home Assistant, etc.).

**Key files:**
- `frontend/src/main.tsx` - ClerkProvider (graceful fallback if key missing)
- `frontend/src/contexts/AuthContext.tsx` - Auth context wrapping Clerk
- `frontend/src/components/layout/UserButton.tsx` - Custom user menu
- `backend/app/auth.py` - `get_auth()` accepts Bearer JWT or X-API-Key
- `backend/app/clerk_auth.py` - JWT verification via JWKS (RS256)
- `backend/app/dependencies.py` - `get_current_user`, `check_list_access`

**Project-specific patterns (differ from generic Clerk docs):**
- No error thrown if `VITE_CLERK_PUBLISHABLE_KEY` missing - app works in API key mode
- Custom `UserButton` component (not Clerk's `<UserButton />`)
- Backend uses PyJWT + JWKS directly (no clerk-backend-api SDK)
- `check_list_access(db, list_id, user, require_edit=bool)` for authorization

**Environment variables:**
- Frontend: `VITE_CLERK_PUBLISHABLE_KEY` (optional)
- Backend: `CLERK_JWT_ISSUER`, `AUTH_MODE` (api_key|clerk|hybrid)

**Research:** `docs/research/clerk-authentication-research.md`

## Code Index

```
|backend/app/services:{ai_service=embeddings+learning,llm_service=NL-parsing(openai|ollama|local),list_service=CRUD,item_service=CRUD,category_service=CRUD+reorder}
|backend/app/api:{lists=CRUD+duplicate,items=CRUD+check+batch,categories=CRUD+reorder,ai=categorize+feedback+parse}
|backend/app:{models=User+List+Category+Item+ListShare,schemas=all-DTOs,auth=hybrid-auth,clerk_auth=JWT-JWKS,dependencies=user-context+list-access,config=env-settings}
|frontend/src/components/items:{ItemInput=AI-suggestions+category-picker,BottomInputBar=mobile-sticky-input,NLParseModal=recipe-review,CategorySuggestion=confidence-toast,ItemRow=display+checkbox}
|frontend/src/components/lists:{ListGrid,ListCard,CreateListModal=type-selection}
|frontend/src/components/layout:{Header,ListHeader=actions+sync,SyncIndicator}
|frontend/src/hooks:{useItems=mutations+optimistic-updates,useLists=queries,useOfflineQueue=IndexedDB-sync,useSwipe=gestures}
|frontend/src/stores:{uiStore=Zustand+theme+collapse+modals}
|frontend/src/api:{client=base-HTTP+ApiError,items,lists,categories,ai=categorize+feedback+parse}
```

## Key Flows

```
AI-Categorization: ItemInput→api/ai.categorize()→ai_service.categorize_item()→embedding-similarity→CategorySuggestion(2s-auto-accept)→user-override?→api/ai.feedback()→CategoryLearning-boost
NL-Parsing: MealMode+input→api/ai.parse()→llm_service.parse()→ParsedItem[]→NLParseModal→useItems.batchCreate()
Item-CRUD: useItems-hook→api/items.ts→backend/api/items.py→item_service.py→optimistic-update+rollback
Offline: useOfflineQueue→IndexedDB-queue→retry-on-reconnect→sync-indicator
```

## Environment Variables

Required for AI features:
- `OPENAI_API_KEY` - For natural language parsing
- `ENABLE_LLM_PARSING=true` - Enable NL parsing
- `LLM_BACKEND=openai` - Use OpenAI backend (also: ollama, local)
- `LLM_OPENAI_MODEL=gpt-4o-mini` - Model to use

## Known Issues

See [TODO.md](./TODO.md) for current bugs and tasks.

## Development Plans

- Phase 4 (Home Assistant Integration): `~/.claude/plans/phase-4-home-assistant-integration.md`

## Development & Testing

```bash
# Backend
cd backend && uv sync && uv run uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm run dev

# Tests
cd backend && uv run pytest
```
