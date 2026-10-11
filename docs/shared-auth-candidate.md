# Inspections mandatory authorization candidate — blocks 48–52

48. Require explicit active Inspections membership in the shared backend. The private rehearsal table starts empty; no user is granted access automatically.
49. Remove unconditional business startup. Every operational section is hidden until a genuine SessionGate has a valid receipt for this origin, app and workspace.
50. Isolate local buffers, jobs and media by origin/workspace/user. A Web Lock prevents concurrent same-account writers. Legacy buffers and IndexedDB are preserved and never silently assigned to the new account.
51. Connect configurable account sign-in and shared-code enrollment/pairing/reset screens. Provide `window.CLOVER_INSPECTIONS_LOGIN={auth,config}` before the entry module, with the configured Supabase auth interface and reviewed endpoint/workspace/public receipt keys/timezone. Missing settings keep it locked.
52. Chromium checks cover actual startup, database isolation, transaction abort on lock, preserved committed drafts and mandatory reload after revocation. PostgreSQL membership tests use synthetic accounts and a mocked upstream Auth verifier.

Not ready for production. The first lock after startup revokes this document; reload and authorize to resume. This deliberately prevents old media/save callbacks from resuming across sessions. In-memory work that has not committed is not guaranteed retained. Full media capture/import/PDF and installed-PWA acceptance, account onboarding, reviewed hosted schema/grants, provider bootstrap and deployment remain pending. No legacy data migration is included. The old `pwa.js` is not loaded by the current entry and remains unchanged.

Review was inspected but not changed: it currently permits local work before login, uses origin-wide storage and has an existing sync/member flow requiring separate integration. Advisor, Review, Routes and Market Intelligence shared-code integrations remain pending.
