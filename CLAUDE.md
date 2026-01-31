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

## UI Patterns

**Modal/Dialog widths:** Never use `w-full` or percentage-based widths for centered modals. When a modal is rendered inside a transformed/animated parent (common with Framer Motion), percentage widths can collapse to near-zero. Always use explicit widths:
- Centered dialogs: `w-[min(24rem,calc(100vw-2rem))]`
- Bottom sheets: `fixed inset-x-0 bottom-0` (full width is fine)
- Side modals: Use explicit `sm:w-[28rem]` style patterns

See `ShareListModal.tsx` and `DeleteListDialog.tsx` for correct patterns.

**Icons:** Use Heroicons (`@heroicons/react`) for UI elements, emojis for category indicators.
- UI buttons/actions: Import from `@heroicons/react/24/outline`
- List type icons: Use `ListTypeIcon` from `components/icons/CategoryIcons.tsx`
- Category emojis: Use `getCategoryEmoji()` from `components/icons/CategoryIcons.tsx`
- Never duplicate emoji/icon mappings - always use the centralized file
- Theme toggle is in the user menu (`UserButton.tsx`), not in the header

## Authentication (Clerk + API Key Hybrid)

Hybrid auth supporting both Clerk user auth and API key auth.

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
|backend/app/services:{ai_service=embeddings+learning,llm_service=NL-parsing(openai|ollama|local),list_service=CRUD+shares,item_service=CRUD,category_service=CRUD+reorder,user_service=Clerk-sync+get_or_create,push_service=web-push+subscriptions,notification_queue=batched-push-delivery,event_broadcaster=SSE-pub/sub}
|backend/app/api:{lists=CRUD+duplicate,items=CRUD+check+batch,categories=CRUD+reorder,ai=categorize+feedback+parse,users=me+lookup,shares=invite+permissions,push=subscribe+preferences,stream=SSE-endpoint}
|backend/app:{models=User+List+Category+Item+ListShare,schemas=all-DTOs,auth=hybrid-auth,clerk_auth=JWT-JWKS,dependencies=user-context+list-access,config=env-settings}
|frontend/src/components/items:{ItemInput=AI-suggestions+category-picker,BottomInputBar=mobile-sticky-input,NLParseModal=recipe-review,CategorySuggestion=confidence-toast,ItemRow=display+checkbox,CategorySection=collapsible-group}
|frontend/src/components/lists:{ListGrid,ListCard,ListCardMenu=long-press-context,CreateListModal=type-selection,EditListModal=rename+icon,ShareListModal=invite-users,DeleteListDialog=confirm-delete}
|frontend/src/components/layout:{Header=title+actions,ListHeader=list-actions+sync,SyncIndicator,UserButton=avatar+theme+signout,Layout=page-wrapper}
|frontend/src/components/icons:{CategoryIcons=ListTypeIcon+getCategoryEmoji}
|frontend/src/components/ui:{Button,Input,Checkbox,Tabs,ErrorBoundary,PullToRefresh}
|frontend/src/components/done:{DoneList=checked-items-section}
|frontend/src/hooks:{useItems=mutations+optimistic-updates,useLists=queries,useShares=share-mutations,useOfflineQueue=IndexedDB-sync,useSwipe=gestures,useAuthSetup=Clerk-token-injection,useListStream=SSE-real-time-sync,usePushNotifications=web-push-subscribe}
|frontend/src/stores:{uiStore=Zustand+theme+collapse+modals,authStore=Zustand+cached-user+offline-persist}
|frontend/src/api:{client=base-HTTP+ApiError,items,lists,categories,ai=categorize+feedback+parse,shares=invite+update+revoke,push=subscribe+preferences}
```

## Key Flows

```
AI-Categorization: ItemInput→api/ai.categorize()→ai_service.categorize_item()→embedding-similarity→CategorySuggestion(2s-auto-accept)→user-override?→api/ai.feedback()→CategoryLearning-boost
NL-Parsing: MealMode+input→api/ai.parse()→llm_service.parse()→ParsedItem[]→NLParseModal→useItems.batchCreate()
Item-CRUD: useItems-hook→api/items.ts→backend/api/items.py→item_service.py→optimistic-update+rollback
Real-Time-Sync: useListStream→EventSource(SSE)→event_broadcaster→publish_event_async→query-invalidation
Push-Notifications: item-change→notification_queue.queue_event()→30s-2min-batching→push_service.send_push()→pywebpush→browser-push-service→sw.ts-handler
Offline: useOfflineQueue→IndexedDB-queue→retry-on-reconnect→sync-indicator
User-Sync: ClerkProvider→useAuthSetup→setTokenGetter→apiRequest(Bearer)→get_auth→get_current_user→user_service.get_or_create_user→local-DB
```

## Environment Variables

Required for AI features:
- `OPENAI_API_KEY` - For natural language parsing
- `ENABLE_LLM_PARSING=true` - Enable NL parsing
- `LLM_BACKEND=openai` - Use OpenAI backend (also: ollama, local)
- `LLM_OPENAI_MODEL=gpt-4o-mini` - Model to use

Optional for push notifications:
- `VAPID_PRIVATE_KEY` - Base64-encoded VAPID private key
- `VAPID_PUBLIC_KEY` - Base64-encoded VAPID public key
- `VAPID_MAILTO` - Contact email for push service (e.g., mailto:admin@example.com)

Frontend (optional):
- `VITE_API_KEY` - Fallback API key when Clerk auth unavailable

## CI/CD & Deployment

**Stack:** GitHub Actions → ghcr.io → Portainer + Watchtower → Caddy → Cloudflare Tunnel

**Key files:**
- `.github/workflows/build.yml` - Builds Docker image, pushes to ghcr.io
- `Dockerfile` - Multi-stage build (frontend + backend)
- `docker-compose.yml` - Production stack config

**Automatic deploy flow:**
1. `git push master` triggers GitHub Actions (~2-3 min build)
2. Actions builds image with `VITE_CLERK_PUBLISHABLE_KEY` (GitHub secret, build-time)
3. Image pushed to `ghcr.io/brettcrane/familylist:latest`
4. Actions auto-purges Cloudflare cache
5. Watchtower polls every 30 seconds, auto-pulls new images
6. Container recreated automatically

**Manual deploy (when Watchtower hasn't picked up changes):**
1. Portainer → **Images** → delete `ghcr.io/brettcrane/familylist` (forces fresh pull)
2. Portainer → **Containers** → familylist-api → **Recreate** → ✅ "Pull latest image"
3. Verify new image: container Image hash should match GitHub Actions build output
4. **Cloudflare cache** → https://dash.cloudflare.com → domain → Caching → Configuration → **Purge Everything**
5. Hard refresh browser (Ctrl+Shift+R) or clear PWA service worker

**Troubleshooting deploy issues:**
- Old JS file in browser? → PWA service worker cached. Clear site data + unregister SW
- Container has old image hash? → Delete image in Portainer, then recreate with pull
- Still old after pull? → Cloudflare CDN cached. Purge everything in Cloudflare dashboard

**Portainer environment variables (runtime):**
- `API_KEY`, `OPENAI_API_KEY` - Core config
- `AUTH_MODE=hybrid`, `CLERK_JWT_ISSUER` - Clerk auth

**GitHub secrets:**
- `VITE_CLERK_PUBLISHABLE_KEY` - Baked into frontend at build
- `CLOUDFLARE_ZONE_ID` - For cache purge
- `CLOUDFLARE_API_TOKEN` - For cache purge (Cache Purge permission)

## Known Issues

See [TODO.md](./TODO.md) for current bugs and tasks.

## Development & Testing

```bash
# Backend
cd backend && uv sync && uv run uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm run dev

# Tests
cd backend && uv run pytest
```
