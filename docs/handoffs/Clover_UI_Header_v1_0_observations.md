# Shared component observations — Inspection adapter

**Owner:** Visual Reconciliation / canonical Clover UI component
**Consumer:** CM-APP — 005, Inspection PWA
**Component:** `clover-shell-header` v1.0.0
**SHA-256:** `15f2cd0261c2363e61b34fbfc0c9a1c1132cb0d8998f7e132379e32abf24dcaa`

The supplied component is consumed unchanged. These are upstream observations,
not local modifications or a request to redesign the Inspection form.

## Narrow title overlap

Reproduction: mount the exact standalone element with
`workspace-name="Inspections"`, `theme="dark"` or `theme="light"`, at 320 CSS px.
In Chromium, the title's actual text ends at x=197.40625 while the action area
starts at x=170. The title overlaps the create action. The same geometry occurs
inside Inspection. No equivalent overlap occurred at 360/390/430/768 in this run.

**Requested owner action:** fix within the canonical component and redistribute
a new checksummed version. Do not fix through consumer CSS/DOM or abbreviate
the consumer's workspace name. Physical iPhone results remain to be collected.

## Local-only status

The contract allows synced/syncing/pending/offline/error, but not local-only.
Inspection has no server connection. Its adapter uses neutral offline for
local-only and explains the state in the existing Data & sync panel. Local
save success never turns into server-synced green.

An eventual distinct local-only state must be supplied by the canonical owner;
no unapproved backend connection or server acknowledgement is fabricated.

## Language

The artifact lists English workspace names and embeds English accessibility
labels without a locale API. Inspection uses the documented Inspections name
and does not mutate internal text. A future bilingual API belongs upstream.

No runtime records, client information, credentials or photo bytes are included
in this handoff.
