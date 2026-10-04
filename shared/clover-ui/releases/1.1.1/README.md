# Clover UI canonical header patch 1.1.1

Visual Reconciliation owns these exact JS/CSS bytes. This public app repository holds the versioned distribution copy for the current eight-app rollout; it does not own other apps' workflows. Consumers fetch a pinned commit, verify SHA-256, and commit both files to their own repository. There is no cross-app runtime/CDN dependency.

JS SHA-256: db4b8232c0ce1cfc993b4a77017428e110817292e91541b7ffee48ce533008fe
CSS SHA-256: e012c44acd41e5dbea2e9764d54ee88fa0088e73eed0150d52f95eb6b7053b98

Patch: actual cloud-sync icon, classic outlined cog, strict-CSP-compatible external stylesheet, no overlapping or truncated workspace names, version-conflict reporting. The existing five events and app business handlers remain unchanged. A full name can wrap rather than being squeezed or hidden. Local offline-DOM verification passed 96 name/width/theme combinations plus event/disabled-state checks. Actual installed-PWA acceptance remains separate.

The installer reads checked-out code/assets only. It does not read or clear browser storage, contact Supabase, alter account permissions, or change client/inspection/quote data. It verifies approved artwork by Git blob hash and marks missing sources pending instead of substituting another icon. Exported icons use new filenames while preserving manifest identity/scope/start URL.
