# Toast Notifications Research

## Problem Statement

The global toast notification (`Toast.tsx`) displays with a **collapsed background** — the `bg-[var(--color-bg-card)]` background renders as a narrow pill while text floats outside its boundaries. This specifically manifests as the success confirmation toast after the duplicate merge flow ("Milk updated to x2").

Four prior PRs attempted fixes without success:
- **PR #47**: Renamed duplicate toast buttons, moved border styling to inline `style` props
- **PR #49**: Removed all remaining Tailwind `border-[var(...)]/opacity` classes (Tailwind v4 `color-mix(in oklab)` bug)
- **PR #51**: Removed Framer Motion `layout` prop and `AnimatePresence mode="popLayout"`
- **PR #53**: Documented the bug in TODO.md (not merged)

## Architecture: Two Separate Toast Systems

The project has **two independent toast systems** with different rendering contexts:

### 1. Global Toast (`Toast.tsx`) — BROKEN
- **Rendered in**: `App.tsx` as a sibling of `<Routes>`, outside any page component
- **Positioning**: `position: fixed` container with `bottom-20 inset-x-0 z-[var(--z-toast)]`
- **State**: Zustand store (`uiStore.toasts[]`), triggered via `showToast(message, type)`
- **Animation**: Framer Motion `initial/animate/exit` with spring transition
- **Used for**: Error messages, success confirmations (e.g., duplicate merge confirmation)

### 2. Category Toast Stack (`CategoryToastStack.tsx`) — WORKS FINE
- **Rendered in**: `ListPage.tsx` inside a `sticky bottom-0 z-40` container, above `BottomInputBar`
- **Positioning**: Normal flow (`px-4 pt-2 pb-1 flex flex-col gap-2`), not fixed/absolute
- **State**: React state in `ListPage` (`recentItems[]`)
- **Animation**: Framer Motion `initial/animate/exit` with identical spring config
- **Used for**: Category assignment toasts, duplicate warning toasts with action buttons

### Rendering Hierarchy

```
App.tsx
├── PersistQueryClientProvider
│   └── BrowserRouter
│       └── ClerkAppContent / FallbackAppContent
│           ├── Routes
│           │   └── ListPage
│           │       ├── Layout > Main (overflow-y-auto)
│           │       │   └── AnimatePresence mode="wait"  ← PAGE TAB TRANSITIONS
│           │       │       └── todo/done content
│           │       └── div.sticky.bottom-0.z-40
│           │           ├── CategoryToastStack  ← WORKS
│           │           └── BottomInputBar
│           └── ToastContainer (fixed)  ← BROKEN
```

### The Broken Flow

1. User adds duplicate item → `CategoryToastStack` shows duplicate toast with "Don't Add" / "Add +1"
2. User taps "Add +1" → `handleMergeQuantity()` chains: `deleteItem` → `updateItem`
3. On success → `showToast('"Milk" updated to x2', 'success')` → global `ToastContainer` renders
4. The success toast appears with collapsed/broken background

## Root Cause Analysis

### What's Been Ruled Out
- **Tailwind v4 `color-mix(in oklab)` border syntax**: Fixed in PR #49 by moving to inline `style` props. Both toast systems now use identical inline border styling.
- **Framer Motion `layout` prop**: Removed in PR #51. Neither toast system uses `layout` or `layoutId`.
- **`AnimatePresence mode="popLayout"`**: Removed in PR #51. Both use default `AnimatePresence` mode.

### Remaining Hypotheses (Ranked by Likelihood)

#### 1. Framer Motion Residual Transforms on `motion.div` (HIGH)

Even without the `layout` prop, Framer Motion's `animate` prop applies CSS transforms during animation. In Framer Motion v12 (the project uses `^12.29.2`), the behavior after animation completes varies:

- During animation: `transform: translateY(0px) scale(1)` (or similar)
- After animation: May leave `transform: none` or clear it entirely, depending on the version

Per the [CSS spec](https://developer.mozilla.org/en-US/docs/Web/CSS/transform), any `transform` value other than `none` on an element creates a **new containing block** for fixed-position descendants. While `ToastContainer` itself is fixed-position and has no fixed descendants, the `motion.div` _inside_ the toast applies transforms to the element that also has `bg-[var(--color-bg-card)]` — meaning the background is on the same element being transformed.

The `scale: 0.9 → 1` animation could cause a brief layout measurement mismatch during entry. If Framer Motion's internal FLIP measurement captures the element's width while `scale(0.9)` is active, the cached layout dimensions would be 90% of actual.

#### 2. `z-[var(--z-toast)]` Tailwind v4 Arbitrary Value Bug (MEDIUM)

The `ToastContainer` uses `z-[var(--z-toast)]` where `--z-toast: 150` is defined in `@theme`. In Tailwind CSS v4, `@theme` values are exposed as CSS custom properties, but the `z-[...]` arbitrary value syntax with `var()` may generate unexpected output depending on the Tailwind v4 version.

If Tailwind v4 fails to generate the `z-index` rule, the container would fall behind other elements — though this would cause visibility issues, not width collapse.

#### 3. Interaction Between `AnimatePresence mode="wait"` in ListPage and Global Toast (MEDIUM)

`ListPage.tsx` line 679 wraps the todo/done tab content in `<AnimatePresence mode="wait">`. When switching tabs, this applies exit/enter transforms to page content. These transforms are on elements _inside_ `<Main>` (which is `overflow-auto`), not on ancestors of `ToastContainer`. However, if React's reconciliation batches the tab animation with a toast show, there could be a timing-dependent layout issue.

#### 4. `w-full max-w-sm` on the Toast Wrapper Inside Flex Container (MEDIUM-HIGH)

Looking at the `ToastContainer` structure:
```tsx
<div className="fixed bottom-20 inset-x-0 z-[var(--z-toast)] flex flex-col items-center gap-2 px-4 pointer-events-none">
  <AnimatePresence>
    {toasts.map((toast) => (
      <div key={toast.id} className="pointer-events-auto w-full max-w-sm">
        <ToastItem toast={toast} />
      </div>
    ))}
  </AnimatePresence>
</div>
```

The outer `div` is `fixed inset-x-0` which should give it viewport width. But `items-center` on the flex column means children are centered and their width is determined by content, not by the container — UNLESS `w-full` is specified on the child, which it is.

However, `AnimatePresence` renders a fragment, and the `div.w-full.max-w-sm` is the actual flex child. If `AnimatePresence` somehow wraps children in an intermediate element (it shouldn't, but worth verifying in v12), the `w-full` would be relative to that wrapper instead of the fixed container.

#### 5. `color-mix(in srgb, ...)` in Inline `border` Style (LOW)

The inline style `border: '1px solid color-mix(in srgb, var(--color-text-muted) 20%, transparent)'` uses `color-mix()` which has ~95% browser support. If a browser doesn't support it, the entire `border` shorthand would be dropped. Since `borderLeft` is set separately, it would still apply, but the main border would be missing. This would cause the border to disappear but NOT cause width collapse.

## Solution Options

### Option A: React Portal + Simplified Animation (RECOMMENDED)

Render `ToastContainer` via `createPortal` directly into `document.body`, completely escaping any possible ancestor style interference. Simplify animations to avoid transforms that could interfere with layout.

**Changes:**
```tsx
// Toast.tsx
import { createPortal } from 'react-dom';

export function ToastContainer() {
  const toasts = useUIStore((state) => state.toasts);

  return createPortal(
    <div
      className="fixed bottom-20 inset-x-0 flex flex-col items-center gap-2 px-4 pointer-events-none"
      style={{ zIndex: 150 }}  // Explicit instead of Tailwind arbitrary value
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="pointer-events-auto w-full max-w-sm"
          >
            <ToastContent toast={toast} />  {/* Non-animated inner div */}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}
```

Key changes:
1. **Portal**: Renders into `document.body`, not into the React tree
2. **Remove `scale` from animation**: `scale: 0.9 → 1` is the most likely transform causing measurement issues. Use `y` + `opacity` only.
3. **Inline `zIndex`**: Replace `z-[var(--z-toast)]` with explicit inline style to avoid any Tailwind v4 arbitrary value issues
4. **Separate animation wrapper from content**: The `motion.div` handles animation, the inner static div handles styling (background, border, layout)

**Pros:** Minimal change, keeps existing custom toast system, high confidence fix
**Cons:** Slightly different animation feel (no scale)

### Option B: Migrate Global Toast to Sonner (ALTERNATIVE)

Replace the global `Toast.tsx` with [Sonner](https://sonner.emilkowal.ski/) (v2.0.7), the most popular React toast library. Keep `CategoryToastStack` as-is since it works and has complex interactive behavior.

**Sonner key facts:**
- 10M+ weekly npm downloads, default in shadcn/ui
- React 19 + Tailwind v4 fully compatible
- Uses **CSS transitions** (not Framer Motion) — avoids all transform/layout issues
- Renders via `position: fixed` CSS (no portal), but proven battle-tested
- `offset` prop to position above sticky bottom bar: `<Toaster offset={{ bottom: '80px' }} />`
- `toast.custom((t) => <JSX />)` for fully custom content if needed
- `unstyled` prop + `classNames` for Tailwind integration
- ~5-7 KB gzipped

**Changes:**
```bash
npm --prefix frontend install sonner
```

```tsx
// App.tsx — replace <ToastContainer /> with <Toaster />
import { Toaster } from 'sonner';

// In ClerkAppContent and FallbackAppContent:
<Toaster
  position="bottom-center"
  offset={{ bottom: '80px' }}
  toastOptions={{
    unstyled: true,
    classNames: {
      toast: 'flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg bg-[var(--color-bg-card)] w-full max-w-sm',
    },
  }}
/>
```

```tsx
// uiStore.ts — replace showToast implementation
import { toast } from 'sonner';

showToast: (message, type = 'error', duration = DEFAULT_TOAST_DURATION_MS) => {
  const method = type === 'error' ? toast.error : type === 'success' ? toast.success : toast.info;
  method(message, { duration });
},
```

**Pros:**
- Battle-tested library, CSS animations avoid Framer Motion issues entirely
- Active maintenance, shadcn/ui ecosystem
- Built-in mobile swipe-to-dismiss
- Better stacking UX with depth effect

**Cons:**
- New dependency (~5-7 KB)
- Need to style to match existing design system
- Two animation systems in the app (Sonner's CSS transitions vs Framer Motion elsewhere)
- The `CategoryToastStack` would still use the existing custom implementation

### Option C: Merge Both Toast Systems (AMBITIOUS)

Migrate both `Toast.tsx` AND `CategoryToastStack.tsx` into Sonner using `toast.custom()` for the interactive duplicate toasts.

**Pros:** Single toast system, consistent behavior
**Cons:** Significant refactor. `CategoryToastStack` has complex interactive state (category picker, timer management, duplicate tracking) tightly coupled to `ListPage`. Recreating this in Sonner's `toast.custom()` would require lifting state management out of the component and into callbacks, which is fragile.

**Not recommended** unless Option A fails.

### Option D: CSS-Only Animation (FALLBACK)

Replace Framer Motion animation in `Toast.tsx` with CSS `@keyframes` animation, removing Framer Motion from the toast rendering entirely.

```tsx
// Toast.tsx - pure CSS approach
function ToastItem({ toast }: { toast: ToastType }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg bg-[var(--color-bg-card)] animate-slide-up"
      style={{
        border: '1px solid color-mix(in srgb, var(--color-text-muted) 20%, transparent)',
        borderLeft: `3px solid ${colorClasses.color}`,
      }}
    >
      {/* ... content ... */}
    </div>
  );
}
```

**Pros:** Zero risk of Framer Motion interference, smallest change
**Cons:** No exit animation (element just disappears), less polished feel. Could add CSS exit animation with more work.

## Recommendation

**Start with Option A (Portal + simplified animation).** It's the smallest change with the highest confidence of fixing the root cause. The key insight is:

1. **Portal** eliminates any possible ancestor style interference
2. **Removing `scale` from animation** eliminates the most likely cause of layout measurement issues
3. **Inline `zIndex`** eliminates the Tailwind v4 arbitrary value variable

If Option A doesn't work (which would be surprising), fall back to **Option B (Sonner)** for the global toast only.

Do NOT pursue Option C unless both A and B fail — the `CategoryToastStack` works correctly and has complex interactive behavior that would be hard to migrate.

## Testing Plan

After implementing the fix:
1. Add a duplicate item to a list
2. Tap "Add +1" on the duplicate toast
3. Verify the success toast ("Item updated to x2") appears with:
   - Full-width background (not collapsed pill)
   - Visible border-left accent color
   - Text fully contained within the background
   - Proper rounded corners and shadow
4. Test error toasts (e.g., network failure) for the same visual correctness
5. Test on iOS Safari (PWA mode) and Android Chrome
6. Verify `CategoryToastStack` still works correctly (no regression)

## Library Comparison Reference

| Feature | Sonner | react-hot-toast | Custom (current) |
|---------|--------|-----------------|-------------------|
| React 19 | Full support | Peer deps OK, slow maint. | N/A |
| Tailwind v4 | First-class (`unstyled`+`classNames`) | goober CSS-in-JS | Full control |
| Animation | CSS transitions | CSS keyframes (goober) | Framer Motion spring |
| Custom JSX | `toast.custom()` | `toast.custom()` (no anim) | Full control |
| Action buttons | Built-in + custom | Requires custom render | Already implemented |
| Bottom bar offset | `offset={{ bottom: '80px' }}` | `containerStyle` | `className="bottom-20"` |
| Bundle size | ~5-7 KB gzip | ~5 KB gzip | 0 KB |
| Maintenance | Active (shadcn/ui default) | Slowing | Self-maintained |

## Key Technical References

- [CSS transform creates new containing block](https://developer.mozilla.org/en-US/docs/Web/CSS/transform) — Spec behavior that breaks `position: fixed` inside transformed ancestors
- [Framer Motion #1117](https://github.com/framer/motion/issues/1117) — `position: fixed` breaks inside `AnimatePresence`
- [Radix UI #1211](https://github.com/radix-ui/primitives/issues/1211) — Toast + Framer Motion interaction bugs
- [Eric Meyer: Un-fixing Fixed Elements](http://meyerweb.com/eric/thoughts/2011/09/12/un-fixing-fixed-elements-with-css-transforms/) — Original documentation of the CSS spec issue
- [Sonner docs](https://sonner.emilkowal.ski/) — Toast library documentation
