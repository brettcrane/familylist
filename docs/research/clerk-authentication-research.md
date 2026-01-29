# Clerk Authentication Integration Research Report

**Date:** January 2026
**Purpose:** Evaluate Clerk for user authentication to enable personal/shared list management in FamilyList

---

## Executive Summary

Clerk is a strong fit for FamilyList's authentication needs. It would enable Google social login with zero OAuth integration work, provide user management out-of-the-box, and support the shared vs. private list model you want. The integration is straightforward with existing FastAPI + React architecture, though it requires meaningful changes to the data model and API authorization layer.

**Key Findings:**
- ✅ Clerk handles Google OAuth entirely—no direct social provider integration needed
- ✅ Free tier (10,000 MAUs) is more than sufficient for family use
- ✅ Official Python SDK and community FastAPI middleware available
- ✅ Organizations feature could support family "households" for sharing
- ⚠️ Requires database schema changes and new authorization logic
- ⚠️ PWA offline mode needs careful token/cache management
- ⚠️ **CRITICAL**: Must use JWT v2 (API version 2025-04-10) — v1 deprecated April 2025

---

## ⚠️ CRITICAL: JWT v2 Migration (April 2025)

**This is essential information for implementation.**

### What Happened

On **April 14, 2025**, Clerk released Session Token JWT v2 and **deprecated v1**. Any new implementation must use the v2 token format and API version `2025-04-10`.

### Key Changes in JWT v2

| Aspect | v1 (Deprecated) | v2 (Current) |
|--------|-----------------|--------------|
| **Version claim** | None | New `v` claim identifies token version |
| **Organization claims** | Flat structure | Nested under `o` claim for compactness |
| **Permissions** | Simple list | Binary bitmask encoding (`o.fpm`) |
| **Token size** | Larger | Optimized/smaller |
| **API version** | 2021-02-05 or 2024-10-01 | **2025-04-10** (required) |

### Impact on Implementation

#### Frontend (@clerk/clerk-react)
- ✅ **No issues** — The React SDK automatically handles v2 tokens
- Just ensure you're using a recent version of `@clerk/clerk-react`

#### Backend (Python/FastAPI)

**Option 1: Official SDK (Recommended)**
```bash
pip install clerk-backend-api>=4.2.0
```
- Latest version is **4.2.0** (December 2025)
- Supports API version 2025-04-10
- Handles v2 token decoding reliably

**Option 2: Community Middleware (Use with Caution)**
```bash
pip install fastapi-clerk-auth
```
- Current version is **0.0.9**
- ⚠️ **Unclear v2 support** — No explicit confirmation in docs/changelog
- May work (JWKS validation is standard), but not officially confirmed
- Recommendation: Test thoroughly or use official SDK instead

### Recommended Backend Approach

Given the v2 migration, prefer **manual JWT validation with the official SDK** or **PyJWT with JWKS**:

```python
# backend/app/auth.py
import jwt
from jwt import PyJWKClient
from app.config import settings

# Clerk JWKS endpoint (get from Dashboard)
CLERK_JWKS_URL = "https://your-instance.clerk.accounts.dev/.well-known/jwks.json"
jwks_client = PyJWKClient(CLERK_JWKS_URL)

# Authorized origins that can generate tokens (CSRF protection)
AUTHORIZED_PARTIES = [
    settings.frontend_url,  # e.g., "https://familylist.example.com"
    "http://localhost:5173",  # Dev
]

async def verify_clerk_token(token: str) -> dict:
    """Verify Clerk JWT v2 token."""
    signing_key = jwks_client.get_signing_key_from_jwt(token)

    decoded = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        # Clerk v2 tokens use these claims
        options={"verify_aud": False}  # Clerk doesn't use aud claim
    )

    # Verify it's a v2 token
    if decoded.get("v") != 2:
        raise ValueError("Expected JWT v2 token")

    # Verify authorized party (CSRF protection)
    azp = decoded.get("azp")
    if azp and azp not in AUTHORIZED_PARTIES:
        raise ValueError(f"Unauthorized party: {azp}")

    return decoded

async def get_current_user(authorization: str = Header(...)) -> str:
    """Extract user ID from Clerk JWT."""
    token = authorization.replace("Bearer ", "")
    decoded = await verify_clerk_token(token)
    return decoded["sub"]  # Clerk user ID
```

### How to Upgrade (for existing Clerk apps)

If you had an existing Clerk implementation on v1:

1. Go to **Clerk Dashboard → Settings → Updates**
2. Click **Upgrade to v2**
3. Update backend SDKs to versions supporting API 2025-04-10
4. Test token validation thoroughly

### Additional v2 Considerations

1. **Organization permissions are compacted**: If using Organizations, the `o.fpm` claim uses binary bitmasks—let the SDK decode this
2. **Supabase JWT template deprecated**: As of April 1, 2025, use native Supabase integration instead
3. **Go SDK completely rewritten**: If using Go, it's a full v2 rewrite with breaking changes

### Sources for JWT v2

- [Session Token JWT v2 Changelog](https://clerk.com/changelog/2025-04-14-session-token-jwt-v2)
- [Session Tokens Documentation](https://clerk.com/docs/guides/sessions/session-tokens)
- [API Versioning Overview](https://clerk.com/docs/guides/development/upgrading/versioning)

---

## Table of Contents

1. [CRITICAL: JWT v2 Migration](#️-critical-jwt-v2-migration-april-2025) ⬆️ (above)
2. [Current State Analysis](#1-current-state-analysis)
3. [Why Clerk Fits Your Needs](#2-why-clerk-fits-your-needs)
4. [Alternatives Comparison](#3-alternatives-comparison)
5. [Technical Integration Details](#4-technical-integration-details)
6. [Database Schema Changes](#5-database-schema-changes)
7. [Shared vs. Private Lists Implementation](#6-shared-vs-private-lists-implementation)
8. [Pricing Analysis](#7-pricing-analysis)
9. [Challenges and Considerations](#8-challenges-and-considerations)
10. [PWA/Offline Implications](#9-pwaoffline-implications)
11. [High-Level Migration Path](#10-high-level-migration-path)

---

## 1. Current State Analysis

### Current Authentication
FamilyList currently uses a **simple API key** (`X-API-Key` header) shared by all users:

```python
# backend/app/auth.py
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(api_key: str | None = Security(api_key_header)) -> str:
    if settings.api_key == "disabled":
        return "disabled"
    if api_key is None or api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return api_key
```

### Current Limitations
| Aspect | Current State |
|--------|---------------|
| User Identity | None—everyone shares one API key |
| Authorization | None—full access to all data |
| List Ownership | Model supports it, not enforced |
| Social Login | Not implemented |
| Sharing | Everything shared by default |

### Existing Infrastructure (Good News)
- `User` model already exists in `backend/app/models.py`
- `List.owner_id` foreign key already exists
- `Item.checked_by` tracks who checked items
- User schemas (`UserCreate`, `UserResponse`) already defined

---

## 2. Why Clerk Fits Your Needs

### Your Requirements → Clerk Features

| Your Need | Clerk Solution |
|-----------|----------------|
| "Simple for my wife—Google login" | Pre-built `<SignIn/>` component with Google OAuth |
| "No social login integration work" | Clerk manages all OAuth credentials/flows |
| "Secure authentication" | Industry-standard JWT tokens, MFA options |
| "User management" | Dashboard to view/manage users |
| "Shared grocery list" | Organizations feature or custom sharing |
| "Private to-do list" | Per-user list ownership with auth checks |

### What Clerk Handles For You
1. **OAuth complexity**: Clerk maintains Google credentials, handles token exchange, manages consent screens
2. **User database**: Stores user profiles, emails, profile pictures
3. **Session management**: Secure token issuance, refresh, expiration
4. **Pre-built UI**: Drop-in React components for sign-in/sign-up
5. **Account management**: Users can manage their own profiles

### Social Login Setup (It's Easy)
For development, Clerk provides **shared OAuth credentials**—you can test Google login with zero configuration. For production, you just:
1. Create a Google Cloud OAuth app
2. Paste credentials into Clerk Dashboard

Clerk handles all redirect URIs, token exchange, and user creation.

> **Note**: Apple Sign-In is available if needed later, but requires a $99/year Apple Developer Program membership to configure production credentials.

---

## 3. Alternatives Comparison

### Feature Comparison

| Feature | Clerk | Auth0 | Firebase Auth | Supabase Auth |
|---------|-------|-------|---------------|---------------|
| **Free MAUs** | 10,000 | 7,500 | 50,000 | 50,000 |
| **Pre-built React UI** | ✅ Excellent | ✅ Good | ⚠️ Basic | ⚠️ Basic |
| **Google/Apple OAuth** | ✅ Easy | ✅ Easy | ✅ Easy | ✅ Easy |
| **FastAPI Support** | ✅ SDK + middleware | ✅ SDK | ⚠️ Manual JWT | ✅ SDK |
| **Organizations/Teams** | ✅ Built-in | ✅ Add-on | ❌ Manual | ❌ Manual |
| **Developer Experience** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Documentation** | Excellent | Complex | Good | Good |
| **Setup Time** | Hours | Days | Hours | Hours |

### Pricing at Scale

| MAUs | Clerk | Auth0 | Firebase | Supabase |
|------|-------|-------|----------|----------|
| 100 | Free | Free | Free | Free |
| 10,000 | Free | ~$240/yr | Free | Free |
| 50,000 | ~$800/mo | ~$1,200/mo | Free | Free |
| 100,000 | ~$1,200/mo | ~$2,400/mo | ~$125/mo | ~$25/mo |

### Recommendation

**For FamilyList: Clerk is the right choice**

Reasons:
1. **Best DX**: Fastest to implement, best React components
2. **Organizations built-in**: Perfect for family "households"
3. **Generous free tier**: 10K MAUs covers any family use
4. **Focus on auth**: Not tied to a database platform
5. **FastAPI support**: Official SDK + community middleware

**When to consider alternatives:**
- **Supabase**: If you want to migrate the entire backend to Supabase (Postgres + Auth + API)
- **Firebase**: If you're deeply in Google ecosystem and need 50K free MAUs
- **Auth0**: Only if you need enterprise features (SAML, HIPAA compliance)

---

## 4. Technical Integration Details

### Frontend (React)

**Installation:**
```bash
npm install @clerk/clerk-react
```

**Setup in main.tsx:**
```tsx
import { ClerkProvider } from '@clerk/clerk-react'

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
    <App />
  </ClerkProvider>
)
```

**Sign-In Component (replaces your current approach):**
```tsx
import { SignIn, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'

function App() {
  return (
    <>
      <SignedOut>
        <SignIn />  {/* Shows Google/Apple login buttons */}
      </SignedOut>
      <SignedIn>
        <UserButton />  {/* Profile dropdown with sign-out */}
        <ListGrid />    {/* Your existing app */}
      </SignedIn>
    </>
  )
}
```

**Getting Token for API Calls:**
```tsx
import { useAuth } from '@clerk/clerk-react'

function useApiClient() {
  const { getToken } = useAuth()

  async function fetchWithAuth(url: string, options: RequestInit = {}) {
    const token = await getToken()
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      },
    })
  }

  return { fetchWithAuth }
}
```

### Backend (FastAPI)

> ⚠️ **Important**: Due to the JWT v2 migration (April 2025), use the official SDK or manual PyJWT validation. See the [JWT v2 section](#️-critical-jwt-v2-migration-april-2025) for details.

**Option 1: PyJWT with JWKS (Recommended for v2)**

```bash
pip install PyJWT cryptography
```

```python
# backend/app/auth.py
import jwt
from jwt import PyJWKClient
from fastapi import Header, HTTPException

CLERK_JWKS_URL = "https://your-instance.clerk.accounts.dev/.well-known/jwks.json"
jwks_client = PyJWKClient(CLERK_JWKS_URL)

async def get_current_user(authorization: str = Header(...)) -> str:
    """Extract user ID from Clerk JWT v2 token."""
    try:
        token = authorization.replace("Bearer ", "")
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        decoded = jwt.decode(token, signing_key.key, algorithms=["RS256"])
        return decoded["sub"]  # Clerk user ID
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=str(e))
```

**Option 2: Official Clerk Python SDK**

```bash
pip install clerk-backend-api>=4.2.0
```

```python
from clerk_backend_api import Clerk

clerk = Clerk(bearer_auth="sk_live_xxx")

# Verify session and get user
user = clerk.users.get(user_id="user_xxx")
```

**Option 3: Community Middleware (v2 compatibility unconfirmed)**

```bash
pip install fastapi-clerk-auth
```
- Version 0.0.9 — may work but no explicit v2 confirmation
- Test thoroughly before production use

**Protecting Routes:**
```python
# backend/app/api/lists.py
from app.auth import get_current_user

@router.get("/lists", response_model=list[ListResponse])
def get_lists(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user)  # Now authenticated!
):
    return list_service.get_lists_for_user(db, user_id)
```

---

## 5. Database Schema Changes

### New/Modified Models

```python
# backend/app/models.py

class User(Base):
    """User model - now synced from Clerk."""
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    clerk_user_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)  # Changed from ha_user_id
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[str] = mapped_column(Text, default=utc_now)

    # Relationships
    owned_lists = relationship("List", back_populates="owner")
    list_shares = relationship("ListShare", back_populates="user")


class ListShare(Base):
    """Sharing permissions for lists."""
    __tablename__ = "list_shares"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    list_id: Mapped[str] = mapped_column(String(36), ForeignKey("lists.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    permission: Mapped[str] = mapped_column(String(20), default="edit")  # "view" | "edit" | "admin"
    created_at: Mapped[str] = mapped_column(Text, default=utc_now)

    # Relationships
    list = relationship("List", back_populates="shares")
    user = relationship("User", back_populates="list_shares")

    __table_args__ = (
        UniqueConstraint("list_id", "user_id", name="uq_list_share"),
    )


class List(Base):
    """List model - add sharing relationship."""
    # ... existing fields ...

    # Add relationship
    shares = relationship("ListShare", back_populates="list", cascade="all, delete-orphan")
```

### Migration Strategy

Since there are no real users or data in production, we'll do a **fresh start**:

1. Wipe existing database (no data to preserve)
2. Update User model: rename `ha_user_id` → `clerk_user_id`, add `email`, `avatar_url`
3. Create new `list_shares` table
4. Deploy fresh schema with Alembic migration

---

## 6. Shared vs. Private Lists Implementation

### Access Control Logic

```python
# backend/app/services/list_service.py

def get_lists_for_user(db: Session, user_id: str) -> list[List]:
    """Get all lists user owns or has access to."""
    return db.query(List).filter(
        or_(
            List.owner_id == user_id,
            List.shares.any(ListShare.user_id == user_id)
        )
    ).all()

def can_access_list(db: Session, list_id: str, user_id: str) -> bool:
    """Check if user can access a list."""
    lst = db.query(List).filter(List.id == list_id).first()
    if not lst:
        return False
    if lst.owner_id == user_id:
        return True
    share = db.query(ListShare).filter(
        ListShare.list_id == list_id,
        ListShare.user_id == user_id
    ).first()
    return share is not None

def share_list(db: Session, list_id: str, owner_id: str, share_with_email: str, permission: str = "edit"):
    """Share a list with another user by email."""
    # Verify ownership
    lst = db.query(List).filter(List.id == list_id, List.owner_id == owner_id).first()
    if not lst:
        raise HTTPException(403, "Not authorized")

    # Find user by email
    target_user = db.query(User).filter(User.email == share_with_email).first()
    if not target_user:
        raise HTTPException(404, "User not found")

    # Create share
    share = ListShare(list_id=list_id, user_id=target_user.id, permission=permission)
    db.add(share)
    db.commit()
    return share
```

### Sharing UI Flow

1. **Owner opens list settings** → sees "Share" button
2. **Enters email** → searches for user in Clerk/local DB
3. **Selects permission** → "Can view" or "Can edit"
4. **Confirms** → Creates ListShare record
5. **Shared user** → Sees list in their list view

### Alternative: Clerk Organizations

Instead of custom `ListShare` table, you could use Clerk's Organizations:

```
Family Household (Clerk Org)
├── Brett (admin)
├── Wife (member)
└── Lists marked "household" visible to all members
```

**Pros:**
- Built-in invite flow via email
- Role management (admin/member)
- User can belong to multiple "households"

**Cons:**
- $1/month per active organization user (after 100 free)
- Less granular than per-list sharing
- May be overkill for 2-person family

**Recommendation:** Start with custom `ListShare` table for simplicity. Clerk Organizations is better for B2B SaaS with team workspaces.

---

## 7. Pricing Analysis

### For FamilyList (Family Use)

| Component | Cost |
|-----------|------|
| 2-10 family users | **Free** (well under 10K MAU) |
| Google OAuth | **Free** (included) |
| Pre-built UI | **Free** (included) |
| Total | **$0/month** |

### If You Shared With Extended Family

| Users | Monthly Cost |
|-------|--------------|
| 50 | Free |
| 500 | Free |
| 5,000 | Free |
| 10,000 | Free |
| 15,000 | ~$100/mo |

### What's NOT Free (Probably Don't Need)
- SMS-based MFA: $0.05/verification
- Enhanced Organizations: $100/mo (custom roles)
- SAML SSO: Enterprise plan
- Extra admin seats: $10/seat/mo (after 3)

---

## 8. Challenges and Considerations

### Technical Challenges

| Challenge | Mitigation |
|-----------|------------|
| **Token refresh** | Clerk SDK handles automatically |
| **User sync** | Create local User on first API call with Clerk ID |
| **Database migration** | Fresh start—no existing users/data to migrate |

### Security Considerations

1. **HTTPS Required**: Clerk tokens must be transmitted over HTTPS
2. **Token Storage**: Frontend stores tokens in memory; for offline PWA support, cache user session in IndexedDB
3. **CORS**: Backend needs proper CORS for Clerk's token requests
4. **Authorized Parties (azp)**: Validate the `azp` claim in JWTs to prevent CSRF attacks (see code sample in [JWT v2 section](#recommended-backend-approach))
5. **Webhook Signing**: Verify Clerk webhooks using SVIX signatures for user sync events

### User Experience Changes

| Before | After |
|--------|-------|
| Open app → immediate access | Open app → sign-in screen (first time) |
| No user identity | User sees their name/avatar |
| All lists visible | Only owned/shared lists visible |
| No logout | Can sign out, switch accounts |

### Potential Gotchas

1. **First-time UX**: Users must sign in before seeing any lists (could show onboarding)
2. **Token expiration**: Need graceful handling when token expires during use
3. **Clerk downtime**: If Clerk is unavailable, new sign-ins won't work. Mitigate by caching user sessions locally so existing sessions can continue viewing/editing cached data offline (see [PWA/Offline section](#9-pwaoffline-implications))
4. **Email changes**: If user changes email in Clerk, need to sync to local DB

---

## 9. PWA/Offline Implications

### Current PWA Setup
FamilyList uses service workers (Workbox) for offline caching and IndexedDB for offline queue.

### Challenges with Auth + Offline

| Scenario | Challenge | Solution |
|----------|-----------|----------|
| **Offline open** | Can't validate token | Cache user session locally, validate on reconnect |
| **Token expires offline** | API calls fail on reconnect | Refresh token when online before retrying queue |
| **Logout on another device** | Cached data still accessible | Sync logout state on reconnect, clear cache |
| **Login redirect cached** | Service worker serves stale redirect | Exclude auth routes from cache |

### Recommended Approach

```typescript
// frontend/src/hooks/useOfflineAuth.ts

function useOfflineAuth() {
  const { isSignedIn, getToken } = useAuth()
  const [cachedUserId, setCachedUserId] = useLocalStorage('cached_user_id')

  // When online and signed in, cache the user ID
  useEffect(() => {
    if (isSignedIn && navigator.onLine) {
      getToken().then(token => {
        const decoded = decodeJwt(token)
        setCachedUserId(decoded.sub)
      })
    }
  }, [isSignedIn])

  // When offline, use cached identity for local operations
  const effectiveUserId = navigator.onLine
    ? currentUserId
    : cachedUserId

  return { effectiveUserId, isOffline: !navigator.onLine }
}
```

### Service Worker Considerations

```javascript
// Exclude auth-related routes from caching
workbox.routing.registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
  })
)

// Never cache Clerk endpoints
workbox.routing.registerRoute(
  ({ url }) => url.hostname.includes('clerk'),
  new NetworkOnly()
)
```

---

## 10. High-Level Migration Path

### Phase 1: Foundation
- [ ] Create Clerk account and configure Google OAuth
- [ ] Add Clerk React SDK to frontend
- [ ] Wrap app in `ClerkProvider`
- [ ] Create JWT verification dependency (PyJWT + JWKS)

### Phase 2: Database
- [ ] Wipe existing database (fresh start, no data to preserve)
- [ ] Update User model (`clerk_user_id`, `email`, `avatar_url`)
- [ ] Create `list_shares` table
- [ ] Add user sync endpoint (creates local user from Clerk on first request)

### Phase 3: Authorization
- [ ] Add `get_current_user` dependency to all routes
- [ ] Implement ownership checks in list service
- [ ] Update `get_lists` to filter by user access
- [ ] Add sharing endpoints (`POST /lists/{id}/share`)

### Phase 4: Frontend
- [ ] Add sign-in/sign-up flow
- [ ] Update API client to use Bearer token
- [ ] Add user profile/avatar to header
- [ ] Create sharing UI in list settings
- [ ] Handle signed-out state gracefully

### Phase 5: Polish
- [ ] Implement offline auth caching (for Clerk downtime resilience)
- [ ] Test PWA offline scenarios
- [ ] Add user sync via Clerk webhooks (optional)

### Phase 6: Deployment
- [ ] Set up Clerk production instance
- [ ] Configure Google OAuth production credentials
- [ ] Deploy backend with new auth
- [ ] Deploy frontend with Clerk
- [ ] Test end-to-end

---

## Summary: Why Clerk is Right for FamilyList

| Requirement | How Clerk Solves It |
|-------------|---------------------|
| Easy Google login | Pre-built `<SignIn/>` with Google OAuth |
| No OAuth integration work | Clerk manages all credentials and flows |
| Secure authentication | Industry-standard JWTs, optional MFA |
| User management | Dashboard + APIs for user CRUD |
| Shared grocery lists | Custom sharing table or Organizations |
| Private to-do lists | Per-user ownership with auth checks |
| Cost | **Free** for family use |
| Developer experience | Best-in-class React + Python support |

### Next Steps When Ready to Implement

1. Create a Clerk account at [clerk.com](https://clerk.com)
2. Create a new application and enable Google social login
3. Copy the publishable key and JWKS URL
4. Wipe existing database (fresh start)
5. Start with Phase 1 above

---

## Sources

- [Clerk Official Documentation](https://clerk.com/docs)
- [Clerk Google OAuth Setup](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google)
- [Clerk Manual JWT Verification](https://clerk.com/docs/guides/sessions/manual-jwt-verification)
- [Clerk Organizations Overview](https://clerk.com/docs/guides/organizations/overview)
- [Clerk Pricing](https://clerk.com/pricing)
- [fastapi-clerk-auth PyPI](https://pypi.org/project/fastapi-clerk-auth/)
- [Clerk FastAPI Integration Guide (Medium)](https://medium.com/@didierlacroix/building-with-clerk-authentication-user-management-part-2-implementing-a-protected-fastapi-f0a727c038e9)
- [Clerk vs Auth0 Comparison](https://dev.to/mechcloud_academy/clerk-vs-auth0-choosing-the-right-authentication-solution-3cfa)
- [Clerk vs Supabase Auth](https://clerk.com/articles/clerk-vs-supabase-auth)
- [Auth Pricing Comparison (Zuplo)](https://zuplo.com/learning-center/api-authentication-pricing)
- [GitHub: fastapi-clerk-middleware](https://github.com/OSSMafia/fastapi-clerk-middleware)
