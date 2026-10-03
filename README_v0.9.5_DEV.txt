Clover Inspection v0.9.5-dev — exact Clover UI Header Component v1.0.0

Accepted base: 99ca2f621669cb045570cf740c1db579a5bbb73a (v0.9.4-dev).
Source: user-supplied Clover_UI_Header_Component_v1_0(1).zip.
Canonical file: shared/clover-ui/clover-shell-header.js
SHA-256: 15f2cd0261c2363e61b34fbfc0c9a1c1132cb0d8998f7e132379e32abf24dcaa
The runtime component and its manifest/README/event contract are byte-identical
copies from the supplied ZIP. No icons, styles, typography, spacing, Shadow DOM,
CSS variables, internal labels or render functions were changed or overridden.

WHAT WAS REPLACED
The local header DOM and shared-header.js / shared-header.css are removed.
The page imports the exact module, renders <clover-shell-header>, and mounts
header-adapter.js. header-integration.css positions the component on the page
(sticky wrapper + measured scroll offset) and retains the existing app-owned
sync/drawer panel styles only. No header appearance overrides are present.

APP-OWNED WIRING
workspace-name: Inspections (the supplied component's documented name).
clover-menu: existing local workspace drawer.
clover-home: existing local Clover Home launcher.
clover-create: existing New Inspection flow, after the existing save/media queue.
clover-sync: existing Data & sync details and Save now action.
clover-settings: existing Inspection Settings sheet.
theme: dark/light from the existing appearance preference.
create-disabled: initial load or an in-flight guarded action.
A failed save prevents navigation; concurrent create/save clicks are guarded.
The shared Clover hub remains unconnected; no route/account endpoint is invented.

TRUTHFUL SYNC BOUNDARY
There is still no server sync. v1 has no local-only sync-state, so the neutral
gray offline value represents no cloud connection here, including when online.
The detail panel explicitly says Local only / No server sync. Pending/error
reflect local save activity. This adapter never emits synced or syncing.
JSON backup still does not contain photo/video bytes.

PRESERVED
Inspection engine, question IDs, evidence code, PDF generator and update guard
are byte-identical to v0.9.4 within their implementation blocks. Database/store
names, localStorage keys and DB_VERSION=4 are unchanged. Only the app release
stamp and header call sites change. No records/photos/fixtures are shipped.
Service-worker asset hashes include the nested module. No auto-activation,
storage deletion, reset or new migration is added.

VERIFICATION
node scripts/verify-header-component.cjs validates the vendor checksum and
integration boundaries. 282 Chromium/component/isolated-storage assertions and
10 service-worker event checks passed. Rendering was compared against the exact
standalone component at 320, 360, 390, 430 and 768 CSS px, light/dark, ES/EN app.
Browser navigation is administratively blocked in the test container; storage
and reconnect tests use a transactional adapter, NOT native durable IndexedDB
or installed-iPhone update proof. Hardware/device acceptance is still pending.

UPSTREAM COMPONENT OBSERVATION
At 320 CSS px the supplied standalone component's Inspections title overlaps
the + area. The integrated app matches the standalone result exactly. No local
fix was made. See docs/handoffs/Clover_UI_Header_v1_0_observations.md.
The supplied component has English-only internal accessibility labels and
specified English workspace names; the rest of this app remains bilingual.
A translation/geometry change requires a new canonical component release.
