# Claude Code Context

## AI Instructions

- Prefer retrieval-led reasoning over training knowledge. Read actual code before assuming patterns.
- Don't assume standard React/FastAPI conventions - check actual implementations first.
- Always read ai_service.py and llm_service.py before modifying AI features.
- Check useItems.ts for mutation patterns before adding new item operations.
- **Always use feature branches and PRs** — never commit directly to master. Create a branch, commit, push, and open a PR via `gh pr create`.

## Project Overview

FamilyList is a family-friendly list management PWA with AI-powered features:
- Multiple list types (grocery, packing, tasks)
- AI categorization using sentence-transformers embeddings
- Natural language parsing via OpenAI for all list types (e.g., "stuff for tacos" → ingredients, "beach trip" → packing items, "hang a picture" → tasks)
- URL recipe extraction: paste a recipe URL → extract ingredients with quantities and units
- Learning system that remembers user corrections

## Architecture

- **Backend**: FastAPI + SQLAlchemy + SQLite
- **Frontend**: React + TypeScript + Tailwind CSS + Framer Motion
- **Auth**: Clerk (optional) + API key fallback
- **AI**: sentence-transformers for embeddings, OpenAI GPT-5 Nano for NL parsing
- **State**: React Query (server, persisted to IndexedDB via idb-keyval) + Zustand (UI) + SW Cache API (offline API responses)
- **Deployment**: Docker via GitHub Actions CI/CD → Portainer

## UI Patterns

**Modal/Dialog widths:** Never use `w-full` or percentage-based widths for centered modals. When a modal is rendered inside a transformed/animated parent (common with Framer Motion), percentage widths can collapse to near-zero. Always use explicit widths:
- Centered dialogs: `w-[min(24rem,calc(100vw-2rem))]`
- Bottom sheets: `fixed inset-x-0 bottom-0` (full width is fine)
- Side modals: Use explicit `sm:w-[28rem]` style patterns

See `ShareListModal.tsx` and `DeleteListDialog.tsx` for correct patterns.

**Toasts:** All toasts use the pattern from `Toast.tsx`: `bg-[var(--color-bg-card)]`, `shadow-lg`, `rounded-xl`, spring animation `{ type: 'spring', damping: 25, stiffness: 350 }`. **All border styling must use inline `style` props** — `border: '1px solid color-mix(in srgb, var(--color-text-muted) 20%, transparent)'` for the subtle border, `borderLeft: '3px solid ${color}'` for the colored accent. **Never use Framer Motion's `layout` prop on toast elements** — it causes width collapse in fixed-position flex containers; use `AnimatePresence` (no mode) with `initial`/`animate`/`exit` instead. Never use Tailwind's `border-[var(...)]/opacity` syntax — Tailwind v4 generates broken `color-mix(in oklab,...)`. Never use transparent/opacity backgrounds for toasts — they become unreadable over scrolling content.

**Icons:** Dual-library approach — Heroicons for UI actions, Tabler Icons for domain-specific icons.
- UI buttons/actions: Import from `@heroicons/react/24/outline`
- List type icons: Use `ListTypeIcon` from `components/icons/CategoryIcons.tsx`
- Category icons: Use `<CategoryIcon category={name} />` from `components/icons/CategoryIcons.tsx`
- List icons (picker/display): Use `<ListIcon icon={id} />` and `LIST_ICON_OPTIONS` from `CategoryIcons.tsx`
- Never duplicate icon mappings - always use the centralized file
- Both libraries use 24x24 outline style for visual consistency
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
|backend/app/services:{ai_service=embeddings+learning,llm_service=NL-parsing(openai|ollama|local)+URL-recipe-extraction,list_service=CRUD+shares,item_service=CRUD+reorder,category_service=CRUD+reorder,user_service=Clerk-sync+get_or_create,push_service=web-push+subscriptions,notification_queue=batched-push-delivery,event_broadcaster=SSE-pub/sub}
|backend/app/api:{lists=CRUD+duplicate,items=create(single)+create-batch(/items/batch)+CRUD+check+reorder,categories=CRUD+reorder,ai=categorize+feedback+parse+extract-url,users=me+lookup,shares=invite+permissions,push=subscribe+preferences,stream=SSE-endpoint}
|backend/app:{models=User+List+Category+Item+ListShare,schemas=all-DTOs+Magnitude-enum+CategoryReorder+ItemReorder,serializers=item_to_response-shared,auth=hybrid-auth,clerk_auth=JWT-JWKS,dependencies=user-context+list-access,config=env-settings,database=SQLite-connection+migrations,mcp_server=MCP-server-setup}
|frontend/src/components/items:{BottomInputBar=input-only+AI-toggle,CategoryToastStack=non-blocking-category+duplicate-toasts,NLParseModal=AI-parse-review+duplicate-indicators,ItemRow=display+checkbox+magnitude-badge+assigned-avatar,CategorySection=collapsible-group,EditItemModal=bottom-sheet-edit+magnitude+assigned-to,FilterBar=search+my-items-filter,SortableItemRow=dnd-kit-item-wrapper,SortableCategorySection=dnd-kit-category-wrapper}
|frontend/src/components/lists:{ListGrid,ListCard,ListCardMenu=long-press-context,CreateListModal=type-selection,EditListModal=rename+icon,ShareListModal=invite-users,DeleteListDialog=confirm-delete,OrganizedListGrid=folder-sections+drag-drop,FolderSection=collapsible-folder+drag-drop,SortableListCard=dnd-kit-list-wrapper,InlineFolderInput=folder-name-input,OrganizeButton=organize-mode-toggle,MoveToFolderModal=move-list-to-folder}
|frontend/src/components/layout:{Header=title+actions,ListHeader=list-actions+sync,SyncIndicator,UserButton=avatar+theme+signout,Layout=page-wrapper}
|frontend/src/components/views:{ViewModeSwitcher=segmented-control-tasks,FocusView=time-bucketed-container,FocusSection=collapsible-time-bucket,PersonGroup=person-grouped-items,TrackerView=task-stats-dashboard,TrackerChart=CSS-stacked-bar-chart}
|frontend/src/components/icons:{CategoryIcons=ListTypeIcon+CategoryIcon+ListIcon+LIST_ICON_OPTIONS}
|frontend/src/components/ui:{Button,Input,Checkbox,Tabs,ErrorBoundary,PullToRefresh,Toast,ErrorState,UpdateBanner=PWA-update-prompt}
|frontend/src/components/done:{DoneList=checked-items-section}
|frontend/src/hooks:{useItems=mutations+optimistic-updates+reorder,useLists=queries,useShares=share-mutations,useCategories=category-mutations,useLongPress=long-press-gestures,useAuthSetup=Clerk-token-injection,useListStream=SSE-real-time-sync,usePushNotifications=web-push-subscribe,useOrganization=folders+sort-order,useFocusItems=time-bucket-grouping,useTrackerStats=stats+timeline-buckets,useServiceWorkerUpdate=SW-update-detection+visibility-nudge,useVersionCheck=build-ID-polling-update-detection}
|frontend/src/stores:{uiStore=Zustand+theme+collapse+modals+taskViewMode+myItemsOnly,authStore=Zustand+cached-user+offline-persist,organizationStore=Zustand+per-user-folders+sort-order+localStorage}
|frontend/src/api:{client=base-HTTP+ApiError,items,lists,categories,ai=categorize+feedback+parse+extractUrl,shares=invite+update+revoke,push=subscribe+preferences}
|frontend/src/utils:{colors=getUserColor-deterministic-avatar-colors,strings=getInitials-from-display-name,dates=daysOverdue+weekBuckets+formatting}
|frontend/src/types:{api=DTOs+MAGNITUDE_CONFIG+AI_MODE_PLACEHOLDERS+AI_MODE_HINTS+UNIT_OPTIONS+formatQuantityUnit}
|frontend/src/pages:{HomePage=list-grid+organization,ListPage=items+views+input+duplicate-detection,SignInPage=Clerk-auth}
```

## Key Flows

```
Item-Entry(single): enter→input-clears-instantly→duplicate-check→(done-match?→uncheckItem+toast+return)→fire-and-forget-IIFE→categorizeItem()→createItem.mutateAsync({category_id})→CategoryToastStack-shows-result(4s)→user-taps-Change?→updateItem+submitFeedback
Item-Duplicate(active): duplicate-found→create-item-normally→status='duplicate'→toast-with-DontAdd/Add+1(5s)→DontAdd?→deleteItem | Add+1?→deleteItem→updateItem(fresh-qty) | auto-dismiss→duplicate-stays
Item-Entry(AI-mode): AiMode+input→setIsInputLoading→api/ai.parse()→llm_service.parse()→ParsedItem[]→NLParseModal→createItem.mutate(each)+onError
URL-Recipe-Extract: paste-URL-in-AI-mode→extractRecipeFromUrl()→POST /ai/extract-url→llm_service.extract_from_url()→_fetch_url(SSRF-validated+redirect-per-hop)→_extract_jsonld_recipe()→RECIPE_NORMALIZE_PROMPT→_call_backend()→ParsedItem[]+display_title→NLParseModal→createItem.mutate(each)
Item-Create: useCreateItem→api/items.createItem()→POST /items(single)→item_service.create_item | useCreateItems→api/items.createItems()→POST /items/batch→item_service.create_items_batch
Item-CRUD: useItems-hook→api/items.ts→backend/api/items.py→item_service.py→optimistic-update+rollback
Real-Time-Sync: useListStream→EventSource(SSE)→event_broadcaster→publish_event_async→query-invalidation
Push-Notifications: item-change→notification_queue.queue_event()→30s-2min-batching→push_service.send_push()→pywebpush→browser-push-service→sw.ts-handler
Offline: PersistQueryClientProvider(idb-keyval)→cached-queries+SW-NetworkFirst(/api/*GET)→SyncIndicator(offline-pill)→reconnect→invalidateQueries
User-Sync: ClerkProvider→useAuthSetup→setTokenGetter→apiRequest(Bearer)→get_auth→get_current_user→user_service.get_or_create_user→local-DB
Drag-Reorder: drag-end→useReorderItems/useReorderCategories→optimistic-sort-update→POST /items/reorder or /categories/reorder→broadcast-event→rollback-on-error
List-Organization: OrganizeButton→organizeMode→drag-lists/folders→setSortOrder→localStorage-persist | MoveToFolderModal→moveListToFolder→organizationStore
Version-Gate: page-load→main.tsx:checkVersionAndBoot()→fetch(/version.json)→compare-vs-__BUILD_ID__→stale?→reload-before-React-mounts | loop-protection:sessionStorage(fl-version-reload,60s) | offline:proceed-with-cache
SW-Update: deploy→new-SW→skipWaiting+clientsClaim→controllerchange→useServiceWorkerUpdate→UpdateBanner+useAutoReloadOnUpdate→reload-on-re-focus
Version-Polling: useVersionCheck→fetch(/version.json?_t=,cache:no-store)→compare-vs-__BUILD_ID__→updateAvailable→UpdateBanner+auto-reload-on-re-focus | triggers:mount(1s)+visibilitychange+2min-interval | throttle:15s-min
```

## Item Fields: Magnitude & Assigned-To

Items support optional magnitude (effort sizing: S/M/L) and assigned-to (user assignment) fields.

**Magnitude:** `Magnitude(str, Enum)` in `schemas.py`, `MAGNITUDE_CONFIG` in `types/api.ts` for display (color, label). Validated at Pydantic enum + DB `CheckConstraint` + TypeScript union levels.

**Assigned-To:** `assigned_to` is a user ID (UUID, 36 chars). `_validate_assigned_to()` in `items.py` verifies user exists AND has list access (owner or `ListShare`). `item_to_response()` in `serializers.py` resolves `assigned_to_name` from the relationship. Duplication preserves magnitude but clears assigned_to.

**UI:** `ItemRow` shows magnitude badge + assigned-to avatar. `EditItemModal` has dropdowns for both. Avatar colors via `getUserColor()` in `utils/colors.ts`, initials via `getInitials()` in `utils/strings.ts`.

## Item Fields: Unit of Measure

Items support optional freeform unit of measure (e.g., "cup", "tbsp", "oz"). Designed for recipe extraction where sites use diverse measurements.

**Backend:** `unit` is `str | None = Field(None, max_length=20)` in `schemas.py`. DB column `String(20)` with `CheckConstraint` for length. No enum — any string up to 20 chars is valid. `formatQuantityUnit()` in `types/api.ts` handles display formatting.

**Frontend:** `EditItemModal` uses `<input list="unit-options">` + `<datalist>` for combobox behavior — users can pick from `UNIT_OPTIONS` suggestions or type any value. `ItemRow` displays quantity+unit via `formatQuantityUnit()`. `quantity` is `float` (supports fractional: 0.5, 1.5, etc.) with minimum 0.25.

**Pattern:** Unit comes from LLM during recipe extraction or NL parsing. Duplicate merge (`handleMergeQuantity`) adds the duplicate's actual quantity (not hardcoded +1) and uses `formatQuantityUnit` for the toast message.

## URL Recipe Extraction

Paste a recipe URL in AI mode (grocery lists only) to extract ingredients with quantities and units.

**Key files:**
- `backend/app/services/llm_service.py` - `extract_from_url()`, `_fetch_url()`, `_extract_jsonld_recipe()`, `_find_recipe_in_jsonld()`, `RECIPE_NORMALIZE_PROMPT`
- `backend/app/api/ai.py` - `POST /ai/extract-url` endpoint
- `backend/app/schemas.py` - `ExtractUrlRequest` (URL validation: https/http, min 10 chars)
- `frontend/src/api/ai.ts` - `extractRecipeFromUrl()` client
- `frontend/src/pages/ListPage.tsx` - URL detection in AI mode input, `handleUrlExtraction()`
- `frontend/src/components/items/BottomInputBar.tsx` - URL detection hint in AI mode

**Flow:** URL pasted → `_fetch_url` (SSRF-validated, manual redirect following with per-hop validation) → HTML parsed for JSON-LD `<script type="application/ld+json">` → `_find_recipe_in_jsonld` recursively finds Recipe schema → raw `recipeIngredient` strings sent to LLM via `RECIPE_NORMALIZE_PROMPT` → normalized `ParsedItem[]` with quantities/units → categorized via embeddings → returned as `ParseResponse`

**SSRF Protection:** `_validate_url_target()` resolves hostname via DNS, checks all IPs against private ranges (127.x, 10.x, 172.16-31.x, 192.168.x, ::1, link-local, AWS metadata 169.254.169.254). `_fetch_url()` uses `allow_redirects=False` and manually follows redirects with SSRF validation at each hop. Max 5 redirects. Uses `urljoin()` for relative redirect resolution. Streaming download with 2MB size limit (checked via both Content-Length header and streaming byte count).

**Cost protection:** No LLM call unless JSON-LD Recipe data is found. Pages without structured recipe data return empty results immediately (no token waste).

## Drag-and-Drop Reordering

Items and categories support manual reordering via `@dnd-kit/core` + `@dnd-kit/sortable`.

**Key files:**
- `frontend/src/components/items/SortableItemRow.tsx` - dnd-kit wrapper for ItemRow with drag handle
- `frontend/src/components/items/SortableCategorySection.tsx` - dnd-kit wrapper for CategorySection, nests SortableItemRow
- `frontend/src/hooks/useItems.ts` - `useReorderItems()` and `useReorderCategories()` mutations
- `frontend/src/api/items.ts` - `reorderItems()` client, `frontend/src/api/categories.ts` - `reorderCategories()` client
- `backend/app/api/items.py` - `POST /lists/{id}/items/reorder`
- `backend/app/api/categories.py` - `POST /lists/{id}/categories/reorder`
- `backend/app/schemas.py` - `ItemReorder`, `CategoryReorder` (list of ordered IDs)

**Pattern:** Drag handle is a `Bars3Icon` button passed as `dragHandleSlot` prop to the base component. `useSortable` uses activator node ref for handle-only dragging. Optimistic reorder on drag end, rollback on error.

## List Organization (Folders & Sorting)

Lists can be organized into folders and reordered on the home page. Per-user, persisted to localStorage.

**Key files:**
- `frontend/src/stores/organizationStore.ts` - Zustand store: `folders`, `listToFolder`, `sortOrder`, `organizeMode` (per-user keyed)
- `frontend/src/hooks/useOrganization.ts` - Scoped hook: `organizeLists()` builds `ListSection[]`, `ensureSortOrder()` reconciles
- `frontend/src/components/lists/OrganizedListGrid.tsx` - DnD context for lists and folders
- `frontend/src/components/lists/FolderSection.tsx` - Collapsible folder with context menu (rename, delete)
- `frontend/src/components/lists/SortableListCard.tsx` - dnd-kit wrapper for ListCard
- `frontend/src/components/lists/InlineFolderInput.tsx` - Inline folder name input
- `frontend/src/components/lists/OrganizeButton.tsx` - Toggle for organize mode
- `frontend/src/components/lists/MoveToFolderModal.tsx` - Bottom sheet to move list into folder

**Pattern:** Organization is client-side only (no backend). API-key mode uses `_default` user key. `organizeMode` is not persisted (resets on reload). Folder IDs use `folder-{timestamp}-{random}` format.

## Item Search & Filtering

**Key files:**
- `frontend/src/components/items/FilterBar.tsx` - Search input + "Mine" toggle chip (shown on shared lists only)
- `frontend/src/stores/uiStore.ts` - `myItemsOnly` (persisted), `searchQuery` is local state in ListPage
- `frontend/src/pages/ListPage.tsx` - Client-side filtering of items by search query and assigned-to

## Duplicate Item Detection

"Create first, correct after" — items are always created immediately. If a duplicate is detected, the user gets a non-blocking toast to remove or merge quantity. Ignoring the toast (or tapping X) keeps the duplicate (safe default, no silent data loss).

**Scenarios:**
- **Done-item duplicate:** Auto-restores (unchecks) the existing item, shows success toast, skips creation
- **Active-item duplicate:** Creates item normally, shows duplicate toast with `[Don't Add]` (red/destructive) and `[Add +1]` (accent) buttons (5s auto-dismiss)
- **AI/NL parse mode:** Shows warning indicators next to duplicate items in `NLParseModal` review screen

**Matching:** Case-insensitive exact name match via `findDuplicateItem()` in `ListPage.tsx`. Frontend-only using cached `list.items`. Prefers unchecked matches. Searches all items regardless of active filters. No fuzzy matching.

**Key files:**
- `frontend/src/pages/ListPage.tsx` - `findDuplicateItem()`, duplicate handling in `handleSingleItem()`, `handleUndoDuplicate()`, `handleMergeQuantity()`
- `frontend/src/components/items/CategoryToastStack.tsx` - `RecentItemEntry.status: 'duplicate'`, `duplicateOfItem` field, duplicate toast variant with undo/merge buttons
- `frontend/src/components/items/NLParseModal.tsx` - `existingItems` prop, `existingItemMap` for O(1) lookup, warning indicators

**Pattern:** `handleMergeQuantity` reads fresh quantity from `list.items` (not the stale snapshot in `duplicateOfItem`), adds the duplicate's actual quantity (not hardcoded +1), and chains mutations sequentially: delete duplicate → on success → update quantity → on success → dismiss toast with `formatQuantityUnit` display. Toast is only removed on mutation success, not immediately.

## Task View Modes (Focus & Tracker)

Within the To Do tab, `type === 'tasks'` lists support three view modes. Grocery/packing lists always show categories view.

**Key files:**
- `frontend/src/stores/uiStore.ts` - `taskViewMode: 'categories' | 'focus' | 'tracker'` (persisted, global not per-list)
- `frontend/src/components/views/ViewModeSwitcher.tsx` - Segmented control with Framer Motion animated indicator
- `frontend/src/components/views/FocusView.tsx` - Time-bucketed sections (Today, This Week, Coming Up, Later, Blocked) with person sub-groups
- `frontend/src/components/views/FocusSection.tsx` - Collapsible time-bucket section
- `frontend/src/components/views/PersonGroup.tsx` - Person-grouped items within a section
- `frontend/src/components/views/TrackerView.tsx` - Stat cards + overdue list
- `frontend/src/components/views/TrackerChart.tsx` - CSS-only stacked bar chart (7 time buckets, per-person colored segments)
- `frontend/src/hooks/useFocusItems.ts` - Pure computation: groups items into time buckets with person sub-groups
- `frontend/src/hooks/useTrackerStats.ts` - Stats + timeline buckets with `computeWeekBuckets()` for perf
- `frontend/src/utils/dates.ts` - `daysOverdue`, `getDateOffsetStr`, `isDateInRange`, `getWeekBucket`, `computeWeekBuckets`

**Pattern:** Focus section IDs use `focus-` prefix (e.g., `focus-today`) stored in the same `collapsedCategories` map — no collision with UUID category IDs. `defaultCollapsed` applied via mount-only `useEffect`.

## PWA Update Detection

Three mechanisms ensure users always run the latest code after a deploy.

**1. Pre-React version gate** (catches stale SW cache on load):
- `frontend/src/main.tsx` - `checkVersionAndBoot()` runs before React mounts: fetches `/version.json`, compares against `__BUILD_ID__`, reloads immediately if stale. Feels like a slightly slow page load, not a visible reload. Loop protection via `sessionStorage('fl-version-reload')` prevents reloading more than once per 60s. Skipped in dev mode. Falls through gracefully if offline or fetch fails.

**2. SW controllerchange** (mid-session desktop updates):
- `frontend/src/hooks/useServiceWorkerUpdate.ts` - Listens for `controllerchange` on `navigator.serviceWorker`
- Also nudges `reg.update()` on `visibilitychange` to prompt mobile browsers to check for SW updates
- Records `hadControllerRef` at mount to skip first-time installs. Try-catch around SW API access for restricted contexts.

**3. Version polling** (mid-session fallback, works everywhere including iOS Safari PWAs):
- `frontend/src/hooks/useVersionCheck.ts` - Fetches `/version.json?_t={timestamp}` with `cache: 'no-store'`, compares against `__BUILD_ID__`
- `frontend/vite.config.ts` - Generates `BUILD_ID` at build time, injects via `define` + writes `dist/version.json` via `closeBundle` plugin
- `frontend/src/sw.ts` - `NetworkOnly` route for `/version.json` (defense-in-depth, prevents SW caching)
- `backend/app/main.py` - Explicit `/version.json` route with `Cache-Control: no-store` headers (prevents Cloudflare/browser HTTP caching)
- Triggers: mount (1s delay), `visibilitychange`, every 2 minutes. Throttled to max once per 15s. Skipped in dev mode (`import.meta.env.DEV`). Stops polling once update detected.

**Mid-session auto-reload:**
- `frontend/src/App.tsx` - `useAutoReloadOnUpdate()`: when SW or version polling detects update, auto-reloads on next hidden→visible transition (so we don't interrupt active editing). Shares `fl-version-reload` sessionStorage key for loop protection.

**Shared UI:**
- `frontend/src/components/ui/UpdateBanner.tsx` - Fixed top bar, non-dismissible, `bg-[var(--color-accent)]`
- `frontend/src/App.tsx` - `updateAvailable = swUpdate || versionUpdate`, wired in both `ClerkAppContent` and `FallbackAppContent`

## Environment Variables

Required for AI features:
- `LLM_OPENAI_API_KEY` - For natural language parsing
- `ENABLE_LLM_PARSING=true` - Enable NL parsing
- `LLM_BACKEND=openai` - Use OpenAI backend (also: ollama, local)
- `LLM_OPENAI_MODEL=gpt-5-nano` - Model to use

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
- `API_KEY`, `LLM_OPENAI_API_KEY` - Core config
- `AUTH_MODE=hybrid`, `CLERK_JWT_ISSUER` - Clerk auth

**GitHub secrets:**
- `VITE_CLERK_PUBLISHABLE_KEY` - Baked into frontend at build
- `CLOUDFLARE_ZONE_ID` - For cache purge
- `CLOUDFLARE_API_TOKEN` - For cache purge (Cache Purge permission)

## Known Issues

See [TODO.md](./TODO.md) for current bugs and tasks.

## Development & Testing

**IMPORTANT: Always use absolute paths or `--prefix`/`--project` flags. Never `cd` into subdirectories — the working directory persists across shell calls and causes path resolution bugs.**

```bash
# Backend dev server
uv run --project /home/brett-crane/code/familylist/backend uvicorn app.main:app --reload

# Frontend dev server
npm --prefix /home/brett-crane/code/familylist/frontend run dev

# Backend tests (10s per-test timeout via pytest-timeout)
uv run --project /home/brett-crane/code/familylist/backend pytest /home/brett-crane/code/familylist/backend/tests -x -q

# Frontend type check
npm --prefix /home/brett-crane/code/familylist/frontend run build

# Frontend lint
npm --prefix /home/brett-crane/code/familylist/frontend run lint
```
