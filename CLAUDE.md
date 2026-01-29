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
- **AI**: sentence-transformers for embeddings, OpenAI GPT-4o-mini for NL parsing
- **State**: React Query (server) + Zustand (UI) + IndexedDB (offline)
- **Deployment**: Docker via GitHub Actions CI/CD → Portainer

## Code Index

```
|backend/app/services:{ai_service=embeddings+learning,llm_service=NL-parsing(openai|ollama|local),list_service=CRUD,item_service=CRUD,category_service=CRUD+reorder}
|backend/app/api:{lists=CRUD+duplicate,items=CRUD+check+batch,categories=CRUD+reorder,ai=categorize+feedback+parse}
|backend/app:{models=User+List+Category+Item+CategoryLearning,schemas=all-DTOs,auth=X-API-Key-header,config=env-settings}
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
