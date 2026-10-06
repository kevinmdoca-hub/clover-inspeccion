# Clover Settings design preview 0.1.1

An isolated, self-contained preview for the shared Settings discussion. Start
with Inspections; the app selector includes all eight proposed menus. The
persona selector demonstrates Kevin, an ordinary team member and management.

Open `settings-preview.html` directly in a modern browser. No build, dependency,
web server or network is required. Do not enter real credentials; credential
forms are deliberately represented as flow descriptions.

## Scope

- Avatar first, with name and role; account actions in a separate view.
- Preferences, Data & storage, App information, and Kevin-only Usage & usability.
- Local-only status for Inspections and Service.
- Inspection backup explicitly excludes photo and video bytes.
- Field Routes automatic/manual timezone preference.
- Prospects-only test-mode example, visible only to the sample Kevin persona.
- Management allocation example under the sample Prospects workspace, reached
  by closing Settings. Uses Yes/No eligibility; it does not change real rules.
- Language and appearance controls are functional within the preview.
- Explicit component text colors prevent a dark host from washing out light-mode
  headings, labels and native select values. The inline variant includes this fix.
- Kevin-only Usage & usability includes Export usage report, preserving the
  selected app, period and user filter. View sample report displays one structured
  JSON example with scope, metrics, definitions, version and coverage fields.
  Missing coverage and completion denominators remain null; the sample makes no
  claim of a completed live export or collected user telemetry.

Every displayed person, metric, role check, storage value and assignment toggle
is illustrative. Kevin-only visibility here is a client-side design simulation,
not production authorization. All-user reporting still requires app-specific
instrumentation, authenticated ingestion and protected backend reads.

## Isolation

The HTML is self-contained, with a restrictive Content Security Policy. It uses
no network API, external resource, cookie, browser storage, service worker,
clipboard, account session or production data. State exists in memory only.
The existing inspection engine, media stores, PDF code, shared header, offline
package and entry point are not changed by this draft.

This belongs on an Inspections-only draft branch while the shared specification
is reviewed. The current Inspection service worker redirects unknown navigations
to its cached app entry point, so this file is not a deployment-ready nested
GitHub Pages route. Open the downloaded HTML directly for this review. Any later
live integration must separately handle navigation, cache checksums, application
identity and restoration of existing local work.

Prospects and all other app releases remain on hold in this workstream. Kevin's
October 6 authorization permits Inspections-only code pushes and deployment;
it does not authorize changes to another app or shared production data.
