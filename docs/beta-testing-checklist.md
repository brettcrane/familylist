# FamilyLists Beta Testing Checklist

Use this checklist to verify all features work correctly before family release.

## Real-Time Sync (SSE)

### Basic Connection
- [ ] Open list on device A → verify SSE connects (check DevTools Network tab for EventSource)
- [ ] Connection shows `connected` event in console
- [ ] Connection persists for extended period (5+ minutes)
- [ ] Connection auto-reconnects after network interruption

### Cross-Device Sync
- [ ] Open same list on two devices simultaneously
- [ ] Check item on device A → appears checked on device B within 1-2 seconds
- [ ] Add item on device A → appears on device B within 1-2 seconds
- [ ] Delete item on device A → disappears from device B within 1-2 seconds
- [ ] Clear completed on device A → updates device B within 1-2 seconds

### Authentication
- [ ] SSE works with Clerk JWT authentication
- [ ] SSE works with API key authentication (if configured)
- [ ] Unauthenticated access is properly rejected

---

## Shared Lists

### Sharing Basics
- [ ] Share list with another user by email
- [ ] Shared user can view the list
- [ ] Shared user can add items (with edit permission)
- [ ] Shared user can check/uncheck items (with edit permission)
- [ ] View-only permission prevents edits

### Sharing State
- [ ] Unshared list shows share icon as inactive
- [ ] After sharing, share indicator appears
- [ ] After removing all shares, indicator disappears

---

## Offline Mode

### Queue Operations
- [ ] Add items while offline → items appear locally
- [ ] Check items while offline → items appear checked locally
- [ ] Delete items while offline → items disappear locally

### Sync on Reconnect
- [ ] Come back online → pending operations sync
- [ ] Items added offline appear on server
- [ ] No duplicate items after sync
- [ ] No data loss during offline period

### Visual Indicators
- [ ] Sync indicator shows "offline" status
- [ ] Pending operations badge visible
- [ ] Sync indicator clears after successful sync

---

## PWA Features

### Installation
- [ ] App installable on iOS (Add to Home Screen)
- [ ] App installable on Android (Install App prompt)
- [ ] App icon appears correctly
- [ ] App opens in standalone mode (no browser chrome)

### Service Worker
- [ ] App loads when offline (cached shell)
- [ ] Static assets cached properly
- [ ] API requests queued when offline

---

## Performance

### Load Times
- [ ] Home page loads < 2 seconds
- [ ] List page loads < 2 seconds
- [ ] Item operations feel instant (optimistic updates)

### Memory
- [ ] App stable during extended use (30+ minutes)
- [ ] No memory leaks with SSE connection

---

## Edge Cases

### Error Handling
- [ ] Network error shows user-friendly message
- [ ] Invalid list ID shows 404 page
- [ ] Unauthorized access shows appropriate error

### Concurrent Edits
- [ ] Two users editing same item → no data corruption
- [ ] Two users checking same item simultaneously → handled gracefully

---

## Testing Notes

### Test Accounts
- **Primary tester**: Brett (admin, list owner)
- **Secondary tester**: Aly (shared user with edit access)

### Test Lists
- **Grocery List**: Primary test list for sharing
- **Packing List**: Secondary test for different list type
- **Tasks**: Test task list features

### Browser DevTools
- Network tab: Monitor SSE connection (`EventStream` type)
- Console: Check for SSE events and errors
- Application tab: Verify service worker status

---

## Sign-off

| Area | Tester | Date | Pass/Fail | Notes |
|------|--------|------|-----------|-------|
| Real-Time Sync | | | | |
| Shared Lists | | | | |
| Offline Mode | | | | |
| PWA Features | | | | |
| Performance | | | | |
| Edge Cases | | | | |

**Final Approval**: _________________ Date: _________
