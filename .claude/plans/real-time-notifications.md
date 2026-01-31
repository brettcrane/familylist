# Real-Time Notifications Implementation Plan

## Current State

FamilyList already has **Layer 1 (Live Sync)** fully implemented via Server-Sent Events:

| Component | Status | Location |
|-----------|--------|----------|
| SSE Backend | ✅ Complete | `backend/app/api/stream.py` |
| Event Broadcaster | ✅ Complete | `backend/app/services/event_broadcaster.py` |
| Frontend Hook | ✅ Complete | `frontend/src/hooks/useListStream.ts` |
| Query Invalidation | ✅ Complete | 500ms debounce built-in |

**What works today:** When User A and User B are both viewing the same list, changes sync in real-time (~1-2 seconds). No notifications needed—they see it instantly.

## What's Missing: Push Notifications (Layer 2)

The gap is when the app is **closed or backgrounded**:
- User A is at the grocery store checking items off
- User B has the app closed on their phone
- User B should get a notification: "Sarah checked 5 items in Groceries"

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Backend (FastAPI)                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Item CRUD ──────► Event Broadcaster ──────► SSE Clients (live sync)    │
│       │                   │                                              │
│       │                   ▼                                              │
│       │           Notification Queue                                     │
│       │                   │                                              │
│       │                   ▼                                              │
│       │           Batch Processor ◄──── Timer (30s-2min window)         │
│       │                   │                                              │
│       │                   ▼                                              │
│       │           Push Service (pywebpush)                               │
│       │                   │                                              │
│       └───────────────────┼──────────────────────────────────────────── │
│                           ▼                                              │
└────────────────► Browser Push Services (Google FCM, Apple APNs, etc)    │
                            │                                              │
                            ▼                                              │
                    User's Device (Service Worker receives push)           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema Changes

### New Table: `push_subscriptions`

```sql
CREATE TABLE push_subscriptions (
    id TEXT PRIMARY KEY,           -- UUID
    user_id TEXT NOT NULL,         -- FK to users
    endpoint TEXT NOT NULL,        -- Push service endpoint URL
    p256dh_key TEXT NOT NULL,      -- Client public key
    auth_key TEXT NOT NULL,        -- Auth secret
    user_agent TEXT,               -- Browser/device info
    created_at TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP,        -- Track activity

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user_id, endpoint)     -- One subscription per endpoint per user
);
```

### New Table: `notification_preferences`

```sql
CREATE TABLE notification_preferences (
    user_id TEXT PRIMARY KEY,      -- FK to users
    list_updates TEXT NOT NULL DEFAULT 'batched',  -- 'always', 'batched', 'off'
    list_sharing TEXT NOT NULL DEFAULT 'always',   -- 'always', 'off'
    quiet_start TIME,              -- e.g., 22:00
    quiet_end TIME,                -- e.g., 07:00

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### New Table: `pending_notifications` (for batching)

```sql
CREATE TABLE pending_notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,         -- Who to notify
    list_id TEXT NOT NULL,         -- Which list
    event_type TEXT NOT NULL,      -- item_checked, item_created, etc.
    item_name TEXT,                -- What item
    actor_user_id TEXT NOT NULL,   -- Who did it (to exclude self)
    actor_name TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    batch_key TEXT NOT NULL,       -- user_id:list_id for grouping

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## Backend Implementation

### Phase 1: Push Subscription Management

**New files:**
- `backend/app/models/push_subscription.py` - SQLAlchemy models
- `backend/app/schemas/push.py` - Pydantic schemas
- `backend/app/api/push.py` - API endpoints
- `backend/app/services/push_service.py` - Push sending logic

**API Endpoints:**

```python
# POST /api/push/subscribe
# Register a push subscription for the current user
{
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
        "p256dh": "base64-encoded-key",
        "auth": "base64-encoded-auth"
    }
}

# DELETE /api/push/unsubscribe
# Remove a push subscription
{
    "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}

# GET /api/push/vapid-public-key
# Get the VAPID public key for the frontend
Response: { "publicKey": "base64-encoded-vapid-public-key" }
```

**VAPID Key Generation (one-time setup):**

```python
# Generate once and store in environment variables
from pywebpush import webpush
import base64
import ecdsa

# Generate ECDSA key pair
private_key = ecdsa.SigningKey.generate(curve=ecdsa.NIST256p)
public_key = private_key.get_verifying_key()

# Convert to base64 URL-safe format
VAPID_PRIVATE_KEY = base64.urlsafe_b64encode(private_key.to_string()).decode()
VAPID_PUBLIC_KEY = base64.urlsafe_b64encode(b'\x04' + public_key.to_string()).decode()

# Store in .env:
# VAPID_PRIVATE_KEY=...
# VAPID_PUBLIC_KEY=...
# VAPID_MAILTO=mailto:admin@familylist.app
```

### Phase 2: Notification Queue & Batching

**New file:** `backend/app/services/notification_queue.py`

**Batching Strategy:**

```python
class NotificationQueue:
    """
    Batches notifications to avoid spamming users during rapid activity.

    Strategy:
    1. First event for a user+list starts a 30-second timer
    2. Each subsequent event extends the timer by 10 seconds (max 2 min total)
    3. After timer expires OR 15+ events accumulated: flush and send
    4. Never notify users about their own actions
    5. Group events by actor: "Sarah added 4 items and checked 2"
    """

    # In-memory batch tracking (could use Redis for multi-worker)
    _pending: dict[str, list[PendingEvent]]  # batch_key -> events
    _timers: dict[str, asyncio.Task]         # batch_key -> flush timer

    INITIAL_DELAY = 30.0      # seconds
    EXTEND_DELAY = 10.0       # seconds per additional event
    MAX_DELAY = 120.0         # 2 minutes max
    MAX_EVENTS = 15           # Force flush after this many
```

**Event Flow:**

```python
async def queue_notification(
    list_id: str,
    event_type: str,
    item_name: str | None,
    actor_user_id: str,
    actor_name: str,
    db: Session
):
    """Queue a notification for all list members except the actor."""

    # Get all users with access to this list
    list_members = get_list_members(db, list_id)

    for member in list_members:
        # CRITICAL: Skip the person who made the change
        if member.user_id == actor_user_id:
            continue

        # Check if user wants notifications for this type
        prefs = get_notification_preferences(db, member.user_id)
        if prefs.list_updates == 'off':
            continue

        # Check quiet hours
        if is_quiet_hours(prefs):
            continue

        # Add to batch
        batch_key = f"{member.user_id}:{list_id}"
        await add_to_batch(batch_key, event_type, item_name, actor_name)
```

**Batch Message Formatting:**

```python
def format_batch_message(events: list[PendingEvent], list_name: str) -> str:
    """
    Format batched events into a human-readable message.

    Examples:
    - "Sarah added Milk, Eggs, and 2 more to Groceries"
    - "Sarah checked 5 items in Groceries"
    - "Sarah added 3 items and checked 4 items in Groceries"
    """

    # Group by actor
    by_actor: dict[str, dict[str, list]] = {}
    for event in events:
        if event.actor_name not in by_actor:
            by_actor[event.actor_name] = {"added": [], "checked": [], "unchecked": [], "deleted": []}

        if event.event_type == "item_created":
            by_actor[event.actor_name]["added"].append(event.item_name)
        elif event.event_type == "item_checked":
            by_actor[event.actor_name]["checked"].append(event.item_name)
        # ... etc

    # Build message
    parts = []
    for actor, actions in by_actor.items():
        action_parts = []
        if actions["added"]:
            if len(actions["added"]) <= 3:
                action_parts.append(f"added {', '.join(actions['added'])}")
            else:
                action_parts.append(f"added {len(actions['added'])} items")
        if actions["checked"]:
            action_parts.append(f"checked {len(actions['checked'])} items")

        if action_parts:
            parts.append(f"{actor} {' and '.join(action_parts)}")

    message = "; ".join(parts)
    return f"{list_name}: {message}"
```

### Phase 3: Push Sending

**New file:** `backend/app/services/push_sender.py`

```python
from pywebpush import webpush, WebPushException

async def send_push(user_id: str, title: str, body: str, data: dict, db: Session):
    """Send push notification to all of a user's registered devices."""

    subscriptions = get_user_subscriptions(db, user_id)

    for sub in subscriptions:
        payload = json.dumps({
            "title": title,
            "body": body,
            "icon": "/icons/icon-192.png",
            "badge": "/icons/badge-72.png",
            "data": data,
            "tag": f"list-{data.get('list_id', 'general')}",  # Group by list
            "renotify": True,  # Alert even if same tag
        })

        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {
                        "p256dh": sub.p256dh_key,
                        "auth": sub.auth_key,
                    }
                },
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={
                    "sub": settings.vapid_mailto,
                }
            )

            # Update last_used_at
            sub.last_used_at = datetime.utcnow()

        except WebPushException as e:
            if e.response.status_code in (404, 410):
                # Subscription expired/invalid - delete it
                db.delete(sub)
            else:
                logger.error(f"Push failed: {e}")

    db.commit()
```

### Phase 4: Integration Points

**Modify existing item service** (`backend/app/services/item_service.py`):

```python
# After creating/updating/deleting items, queue notifications

async def check_item(db: Session, item_id: str, user: User) -> Item:
    item = get_item(db, item_id)
    item.is_checked = True
    db.commit()

    # Existing: Broadcast to SSE subscribers (live sync)
    await event_broadcaster.publish(ListEvent(
        event_type="item_checked",
        list_id=item.list_id,
        item_id=item.id,
        item_name=item.name,
        user_id=user.id,
        user_name=user.display_name,
    ))

    # NEW: Queue push notification for background users
    await notification_queue.queue_notification(
        list_id=item.list_id,
        event_type="item_checked",
        item_name=item.name,
        actor_user_id=user.id,
        actor_name=user.display_name,
        db=db,
    )

    return item
```

---

## Frontend Implementation

### Phase 1: Service Worker for Push

**Modify existing service worker** (`frontend/public/sw.js` or create new):

```javascript
// Handle push notifications
self.addEventListener('push', function(event) {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/badge-72.png',
    tag: data.tag,  // Groups notifications by list
    renotify: data.renotify !== false,
    data: data.data,  // Custom data (list_id, etc.)
    actions: [
      { action: 'open', title: 'Open List' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const listId = event.notification.data?.list_id;
  const url = listId ? `/lists/${listId}` : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
```

### Phase 2: Push Subscription Hook

**New file:** `frontend/src/hooks/usePushNotifications.ts`

```typescript
export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check browser support
    setIsSupported(
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );

    // Check existing subscription
    checkSubscription();
  }, []);

  async function checkSubscription() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    setIsSubscribed(!!subscription);
  }

  async function subscribe() {
    setIsLoading(true);

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Get VAPID public key from server
      const { publicKey } = await api.get('/push/vapid-public-key');

      // Subscribe to push
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,  // Required for Chrome
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Send subscription to server
      await api.post('/push/subscribe', {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
          auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')))),
        }
      });

      setIsSubscribed(true);
    } catch (error) {
      console.error('Push subscription failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function unsubscribe() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      await api.delete('/push/unsubscribe', {
        endpoint: subscription.endpoint,
      });
    }

    setIsSubscribed(false);
  }

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
}
```

### Phase 3: Notification Settings UI

**New file:** `frontend/src/components/settings/NotificationSettings.tsx`

```typescript
function NotificationSettings() {
  const { isSupported, isSubscribed, subscribe, unsubscribe } = usePushNotifications();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

  if (!isSupported) {
    return (
      <div className="text-gray-500">
        Push notifications are not supported in this browser.
        {/* iOS hint */}
        {/iPhone|iPad/.test(navigator.userAgent) && (
          <p className="mt-2 text-sm">
            On iOS, install FamilyList to your home screen to enable notifications.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Push Notifications</h3>
          <p className="text-sm text-gray-500">
            Get notified when family members update shared lists
          </p>
        </div>
        <Toggle
          checked={isSubscribed}
          onChange={(enabled) => enabled ? subscribe() : unsubscribe()}
        />
      </div>

      {isSubscribed && (
        <>
          <div className="border-t pt-4">
            <label className="block text-sm font-medium mb-2">
              List Updates
            </label>
            <select
              value={prefs?.list_updates || 'batched'}
              onChange={(e) => updatePrefs({ list_updates: e.target.value })}
              className="w-full rounded-md border p-2"
            >
              <option value="always">Always (may be frequent)</option>
              <option value="batched">Batched (recommended)</option>
              <option value="off">Off</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Quiet Hours
            </label>
            <div className="flex gap-2 items-center">
              <input type="time" value={prefs?.quiet_start} onChange={...} />
              <span>to</span>
              <input type="time" value={prefs?.quiet_end} onChange={...} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

---

## iOS Considerations

**Critical limitation:** Push notifications on iOS only work for PWAs installed to the home screen (since iOS 16.4).

**User guidance needed:**
1. Detect iOS without home screen installation
2. Show prompt: "Install FamilyList to enable notifications"
3. Provide "Add to Home Screen" instructions
4. After installation, prompt for notification permission

```typescript
function isIOSWithoutInstall(): boolean {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;
  return isIOS && !isStandalone;
}
```

---

## Environment Variables

Add to `.env` and Portainer:

```bash
# VAPID keys for Web Push (generate once, keep secret)
VAPID_PRIVATE_KEY=your-base64-private-key
VAPID_PUBLIC_KEY=your-base64-public-key
VAPID_MAILTO=mailto:admin@familylist.app

# Optional: Redis for multi-worker batching (default: in-memory)
# REDIS_URL=redis://localhost:6379
```

---

## Testing Plan

### Manual Testing

1. **Subscribe/Unsubscribe:**
   - Enable notifications in settings
   - Verify subscription saved in database
   - Disable notifications
   - Verify subscription removed

2. **Basic Notification:**
   - User A and User B share a list
   - User B closes the app
   - User A adds an item
   - User B receives notification within 30 seconds

3. **Batching:**
   - User A rapidly checks 10 items (within 30 seconds)
   - User B receives ONE notification: "Sarah checked 10 items in Groceries"

4. **Self-Notification Skip:**
   - User A adds items
   - User A does NOT receive notifications about their own actions

5. **Quiet Hours:**
   - Set quiet hours to current time
   - Verify no notifications received during quiet hours

6. **iOS Installation:**
   - Open app in Safari on iOS
   - Verify prompt to install to home screen
   - After install, verify notification permission request works

### Automated Testing

```python
# backend/tests/test_push.py

def test_subscription_crud():
    """Test creating, listing, and deleting push subscriptions."""
    pass

def test_notification_batching():
    """Test that rapid events are batched correctly."""
    pass

def test_self_notification_skip():
    """Test that users don't get notified about their own actions."""
    pass

def test_quiet_hours():
    """Test that notifications respect quiet hours."""
    pass
```

---

## Implementation Order

| Phase | Description | Effort | Dependencies |
|-------|-------------|--------|--------------|
| 1 | Database schema + models | 2 hours | None |
| 2 | Push subscription API | 3 hours | Phase 1 |
| 3 | Service worker push handling | 2 hours | Phase 2 |
| 4 | Frontend subscription hook | 2 hours | Phase 3 |
| 5 | Notification queue + batching | 4 hours | Phase 1 |
| 6 | Push sending service | 2 hours | Phase 2, 5 |
| 7 | Integration with item service | 2 hours | Phase 6 |
| 8 | Settings UI | 3 hours | Phase 4, 6 |
| 9 | iOS detection + guidance | 2 hours | Phase 8 |
| 10 | Testing + polish | 4 hours | All |

**Total estimated effort: ~3-4 days**

---

## Future Enhancements (Out of Scope)

- **Email digests:** Daily/weekly summary of list activity
- **Per-list notification settings:** Different settings per shared list
- **Rich notifications:** Show item images, action buttons
- **Notification history:** In-app inbox of past notifications
- **Analytics:** Track notification engagement rates

---

## Summary

This plan adds push notifications to FamilyList while avoiding notification fatigue:

1. **Smart batching:** 30-sec to 2-min windows prevent spam during active shopping
2. **Self-skip:** Users never see their own actions
3. **User control:** On/batched/off toggle + quiet hours
4. **iOS support:** Guidance for home screen installation requirement

The existing SSE infrastructure handles in-app real-time sync perfectly. Push notifications only fire when the app is backgrounded, making them genuinely useful rather than annoying.
