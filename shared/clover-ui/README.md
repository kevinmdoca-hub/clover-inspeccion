# Clover UI — Shared Header Component v1.0

This is the **actual shared header component**. App teams should consume it, not redraw it.

## Why this exists
The earlier handoffs produced visually different headers because each app recreated the design using its own icons, CSS, spacing, and legacy components.

This package removes that interpretation.

## Integration

### 1. Add the file unchanged
Copy `dist/clover-shell-header.js` into the app repository without editing it.

Recommended path:

`/shared/clover-ui/clover-shell-header.js`

The file is self-contained:
- styles are inside Shadow DOM
- Clover mark is embedded
- menu / plus / sync / settings SVGs are embedded
- no external CSS or icon library is needed

### 2. Import it

```html
<script type="module" src="/shared/clover-ui/clover-shell-header.js"></script>
```

### 3. Render it

```html
<clover-shell-header
  workspace-name="Prospects"
  sync-state="synced"
  theme="dark">
</clover-shell-header>
```

Allowed workspace names:
- Prospects
- Inspections
- Review Workspace
- Rental
- Service
- Cost & Pricing
- Market Intelligence
- Field Routes

Allowed `sync-state` values:
- `synced`
- `syncing`
- `pending`
- `offline`
- `error`

Theme:
- `dark`
- `light`

Use the `create-disabled` attribute when the workspace's create action must be temporarily disabled.

## Wiring behavior

The component emits these DOM events:

- `clover-menu`
- `clover-home`
- `clover-create`
- `clover-sync`
- `clover-settings`

Example:

```js
const header = document.querySelector('clover-shell-header');

header.addEventListener('clover-menu', openWorkspaceDrawer);
header.addEventListener('clover-home', goToCloverHome);
header.addEventListener('clover-create', openCreateFlow);
header.addEventListener('clover-sync', openOrRunSync);
header.addEventListener('clover-settings', openSettings);
```

Update sync state from app logic:

```js
header.setAttribute('sync-state', 'syncing');
// later
header.setAttribute('sync-state', 'synced');
```

## Important rule
**Do not edit the component's visual code inside individual apps.**

The only app-owned pieces are:
- workspace name
- sync state
- handlers for the five emitted events
- theme value
- whether create is temporarily disabled

If a visual change is needed, update the canonical component once in the Visual Reconciliation workstream and redistribute the new version.

## Long-term recommendation
Move this exact component into a shared internal package such as `@clover/ui` so every app imports one version instead of carrying a byte-identical vendored copy.
