CLOVER INSPECTION PWA — v0.9.3-dev
Single bilingual DEV patch | October 1, 2026

BASELINE / DEPLOYMENT
Built from the attached v0.9.2 DEV package, whose app.js matches GitHub main blob
1ff39cbeac4b83bbf9c18d41e7027d992f496bb2 when inspected.
This ZIP is packaged, not deployed. No remote files or physical-device records
were changed by preparing it. Do not replace a stable technician build blindly.

Upload the root files together to the existing DEV/test repository at one commit.
Do not change the repository path, delete the installed app, or clear site data.
The v0.9.0 DEV database name, version 4 stores, and working-record keys are retained.
Updating code does not create a backend connection or sign the user in.

MAIN CORRECTIONS
- Restore equipment-type options before assigning the persisted selection.
- Current question IDs are no longer incorrectly passed through the old 0.7.2 map.
- Count the real data-plate image once; show the exact missing identity requirement.
- All readiness counters use data/evidence validation, not hidden workspace controls.
- Resume the last worked section of existing incomplete work; no history = collapsed.
  New work starts at Section 1. Completed work opens collapsed.
- Sticky Work Mode header, manual Save now, truthful local-save state.
- English Back to Work; readable dark-theme PDF selection; separate unit title/subtitle.
- Remove obsolete Pilot objective / Field feedback cards.
- Purpose-aware PDF party/location/date; acquisition seller never comes from client.
- Preliminary/Final only in the header; no second warning banner.
- Correct short equipment-type labels, measured right-aligned spec values.
- Captured photo grid compacts; pending required-photo note has separate reserved space.
- Better table pagination and a final inspection/service summary, even with no findings.
- Existing unknown/not-tested responses remain unknown, not Normal.
- ES dates DD/MM/YYYY with 24-hour times; EN MM/DD/YYYY with AM/PM.
- Photo time says Added when only an app-added timestamp exists. No invented capture time.
- Videos remain reference-only in the PDF. Existing 10/30-second limits remain.

EXISTING RECORDS WITH A BLANK EQUIPMENT TYPE
The old build could save Equipment Type blank on reopen. This patch cannot know
which type was lost. It will show “Missing: 1-B Equipment type” and will not infer
that type from make/model or from a photo.
For the known QA unit only: explicitly reselect the known 4-wheel sit-down type.
Changing type uses the approved Make/Model clearing rule; re-enter Crown / C5 1050
if those two fields clear. Keep the existing serial, unit number, notes, photos,
and all findings. Do not delete/re-add the data-plate image.

DATA AND UPDATE PROTECTION
- Structured latest state and the current work-queue record commit together.
- A failed IndexedDB save is not reported as a successful persistent save.
- Evidence replacement commits the new file and removes the old slot atomically.
- Invalid/empty replacement files do not justify deleting the original.
- Leaving a work view saves first; the old global “Clear session” is replaced by
  non-destructive “Close inspection view”.
- A pre-patch structured checkpoint is retained locally. Media remains in place.
- Updates await pending photo operations and save acknowledgement.
- New app assets must match the release hashes; partial/corrupt downloads do not
  activate. Existing caches are not deleted by the new worker.
- An update in another tab does not force a currently editing tab to reload.

These are implementation safeguards, not physical-device recovery acceptance.
The checkpoint is NOT a complete standalone media backup. Current JSON export/
import still does not contain image/video bytes. Do not use JSON import, deleting
Safari data, or reinstalling as a recovery or normal troubleshooting procedure.

NOT INCLUDED / NOT CONNECTED
Central Clover login and technician autofill; cloud sync; complete media backup/
restore; Costing/MI receipts; full shared Field/Shop shell reconciliation.
The nine existing inspection purposes still use the existing technical checklist.
No extra inspection sections or real operational data are bundled.

QA
See QA_v0.9.3_DEV.txt. Source / Chromium DOM + simulated storage / physical iPhone
acceptance are separate evidence layers. This remains DEV, not field-ready.
