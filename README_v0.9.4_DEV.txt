Clover Inspection v0.9.4-dev — Shared Header v1.1

BASE / SCOPE
Based on approved/live 0.9.3-dev (4df00415a5dc8c2434e369b55d86f1b7064141d5).
Implements Clover_Header_Reconciliation_v1_1(4).zip, locked 2026-10-02.
A shell-only bilingual patch: no new inspection sections, profiles, auth, sync,
PDF layout, migration rules, local database/store names, or media semantics.
The only app-version stamp changes from 0.9.3-dev to 0.9.4-dev.

HEADER
Hamburger | standalone gold Clover mark | Inspections/Inspecciones | + | Sync | Settings.
Geometry and SVGs match the actual Advisor Prospects locked v1.1 implementation:
44px square controls, 13px radius, 21px icons, 1.9 stroke; shared spacing.
Only workspace name is visible, never a second Clover wordmark/subtitle.
Long text is preserved; a soft wrap point supports very narrow 320px displays.
+ is present in both workspace and Work Mode; preserves the existing create form.
New inspection and workspace navigation await the existing media/save queue;
a failed local save stops navigation. No inspection is reset by opening a menu.
No full-yellow create button. Neutral hamburger/settings/sync surfaces.

DATA & SYNC
Circular-arrows Sync icon opens details, with Save now and access to Settings.
Current adapter is LOCAL ONLY: gray = local/offline, amber = local save pending,
red = local save error. Successful local saves never set server-synced green.
The common component has green/sync animation styles for a future approved
server integration, but this local adapter never emits synced or syncing.
No new backend, account, heartbeat, analytics or upload endpoint is added.
JSON backup remains STRUCTURED DATA ONLY: it does not contain image/video bytes.

NAVIGATION BOUNDARY
No approved global Clover Home URL was supplied. The Clover mark opens a
truthfully labeled local Clover Home/workspace launcher. Hamburger opens the
same verified workspace list. Inspections returns to the local Today view;
Prospects opens its established GitHub Pages URL and uses its own sign-in.
No guessed routes for other workspaces and no inspection data sent to Prospects.
Global hub routing remains unconnected. Field/Shop inspection-type filtering
from the older master-ledger handoff is NOT invented in this header-only patch;
the current nine-purpose create workflow is preserved pending its approved matrix.

SAFE AREA
Theme is applied before first paint. Dark HTML/header/safe-area surfaces and
Apple status-bar metadata are matched; a measured header height offsets scroll
targets. Hardware iPhone status-bar treatment still needs device acceptance.

RELEASE SAFETY
Service-worker asset hashing includes shared-header.js and shared-header.css.
Caches stay versioned/scope-specific. No forced activation or cache/storage clear
is added. No runtime records, user photos, QA fixtures or private data are shipped.

CURRENT EVIDENCE
Chromium layout/interaction tests at 320/360/390/430/768 px, ES/EN, light/dark.
Storage assertions use a transactional test adapter because native browser URL
navigation is blocked in this environment. These do NOT prove native IDB or
physical-device photo/offline/update durability. Existing QA results are retained.
Do not declare field readiness based on this development patch.
