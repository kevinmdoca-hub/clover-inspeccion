Clover Inspection PWA — v0.9.1 DEV
Advisor-shell rebuild

Purpose
-------
This release replaces the v0.9.0 custom workspace shell with the proven UI patterns from the Clover Advisor Prospects PWA while preserving the existing Inspection engine.

Major shell changes
-------------------
- Sticky Clover top bar using Advisor proportions, icon buttons, and brand mark.
- Global + action opens New Inspection in an Advisor-style bottom sheet.
- Settings gear opens the same bottom-sheet interaction pattern used in Advisor.
- Fixed four-tab bottom navigation: Today / Work / Calendar / Clients.
- Advisor-style inspection-job cards, status pills, metric cards, search, filter chips, and client cards.
- Month calendar uses Today, previous/next month, date cells, event counts, and a selected-date agenda.
- Opening an inspection enters Work Mode; bottom navigation disappears and the proven 14-section Inspection workflow remains intact.
- iOS background-scroll locking and sheet containment follow the Advisor PWA pattern.
- Explicit service-worker update activation remains in place.
- Single bilingual package. Language and theme are controlled from Settings.

Inspection engine retained
--------------------------
- Offline/local save architecture
- Multiple units
- 14-section inspection flow
- Conditional LP/electric logic
- Guided photo workflow
- Finding evidence and video limits
- Missing-item review
- JSON/CSV exports
- Condition-report PDF engine
- Efficiency instrumentation already present in the Inspection engine

Inspection types available
--------------------------
- Fleet baseline condition
- Pre-sale / warranty baseline
- Acquisition / intake
- Rental out
- Rental return
- Preventive maintenance (PM)
- Delivery handoff
- Incident / damage
- Warranty claim

Scope note
----------
All inspection types still use the full current checklist in this DEV release. The selected type controls purpose/workspace labeling and report title. Type-specific technical profiles should be designed and tested separately.

Backend note
------------
This remains a local-first DEV build. Central authentication, shared customer/equipment records, Supabase evidence synchronization, review queues, and Mission Control integration are not claimed as complete here.
