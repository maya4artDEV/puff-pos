# PLAN: single-writer sync rewrite

Executes `docs/specs/sync-single-writer.md`. Do tasks **in order**, one at a time.
Per task, non-negotiable: `view` the function first (line numbers drift as you edit) → surgical `str_replace` → extract `<script>` and `node --check` (0 errors) → run the test scenario in your head → bump the build stamp (3 places: line 11 meta, line 12 title, `#buildVer` ~line 615) → report evidence → stop for Tony before the next task.
Conventions: `var` only, `function(){}`, DOM via `el()`, no `innerHTML` concat, no template literals. Never touch `el()` or the `puff7_` key format.

Grounding (verified in build 20260815.0648):
- `activityScore` @1034 · `isEmptyState` @1052 · sync enqueue @~2975 · `flushSyncQueue` @2987 · `migrateBranchKeys` @3010 · `prefetchCloudState` @3037 (merge @3057–3072) · `refreshFromCloud` @3099 · HQ `state_list` fetch @3197 · `doLogin` @1180 · `currentBranch` set @1093.
- Offline queue already exists (`puff10_syncQueue` + `online` listener @3094). Server merge = `scoreState` in `backend/owner/Code.gs` + `backend/franchise/Code.gs`.

---

## Task 1 — add device mode (writer/viewer), default writer
Goal: introduce `puff7_device_mode` without changing any behavior yet.
- Add helper `getDeviceMode()` returning `localStorage.getItem("puff7_device_mode") || "writer"` and `setDeviceMode(m)`.
- In the login screen (`#loginScreen` @547, wired near `doLogin` @1180), add a small toggle: "โหมดเครื่อง: ผู้บันทึก (writer) / ดูอย่างเดียว (viewer)". Build it with `el()`. Persist on change.
- Show the current mode somewhere visible after login (near the build stamp / sync icon) so a device is never silently wrong.
Test: toggle persists across reload; default with no stored value = writer; no change to sync yet.
Gate: node --check, build bump.

## Task 2 — viewer hard-gate on state writes (the fast safety win)
Goal: a viewer device never writes cloud state → kills empty-state poisoning immediately.
- In the enqueue function (@~2975, the one that pushes to `puff10_syncQueue`): if `getDeviceMode() === "viewer"`, return early — do not enqueue, do not POST `state_save`.
- Belt-and-suspenders: at the top of `flushSyncQueue` (@2987), if viewer, clear the queue and return.
- Leave sale/fry/gift audit POSTs alone (they write separate audit rows, not CloudState) — a viewer won't trigger them anyway.
Test: set device = viewer → make any change → confirm `puff10_syncQueue` stays empty and no `state_save` fires (Network tab). Set = writer → still enqueues normally.
Gate: node --check, build bump. **After this ships, set Tony's HQ device = viewer.**

## Task 3 — writer state carries lastSaved (ordering for recovery)
Goal: ensure each saved state has a fresh `lastSaved` timestamp so recovery/refresh ordering is well-defined.
- Wherever local state is persisted on save, set `state.lastSaved = Date.now()` before `localStorage.setItem`. (Check it isn't already set; if it is, no-op this task.)
Test: after a sale, the stored state JSON has a recent `lastSaved`.
Gate: node --check, build bump.

## Task 4 — read path: remove the merge
Goal: no more activityScore reconciliation on read. Behavior splits by mode.
- In `prefetchCloudState` (@3037), replace the merge block (@3057–3072) with:
  - `viewer`: always overwrite local with cloud (`localStorage.setItem(key, JSON.stringify(data.state))`).
  - `writer`: overwrite local **only if** local is absent OR `isEmptyState(localSt)` is true (recovery for a new/cleared device). Otherwise keep local untouched (the writer owns its branch-day).
- In `refreshFromCloud` (@3099): `viewer` → refresh from cloud as now. `writer` → only re-pull when local for the current branch-day is empty; otherwise do nothing (don't let a re-open clobber the writer's own edits).
Test: writer with real local data, reopen app → local unchanged. Writer with empty local (simulate new tablet) → pulls cloud. Viewer → always shows cloud.
Gate: node --check, build bump.

## Task 5 — server: state_save = plain upsert (Owner + Franchise)
Goal: server stops rejecting a writer's push. Do **both** scripts; state which you're editing.
- In `backend/owner/Code.gs` and `backend/franchise/Code.gs`: `view` the `state_save` handler + `scoreState`. Make `state_save` upsert the CloudState row for branch+date unconditionally (latest write wins). Remove the `scoreState`-based rejection.
- Keep one cheap guard if easy: ignore a payload that is entirely empty (all-zero state) so a stray empty can't blank a good row — but do NOT gate on score.
- Redeploy BOTH via *Manage deployments → edit → New version* (URLs must not change).
Test (remote, no site visit): from a writer device, save → open the CloudState sheet → the row equals what the device has. Client uses `no-cors`, so verify via the sheet, not a client response.
Gate: node --check is N/A for .gs; instead confirm the deployed version number changed and a test write lands.

## Task 6 — verify offline queue end-to-end
Goal: confirm the existing queue works under the new no-merge model. Likely no code change.
- Trace: airplane mode → writer makes 3 sales → queue holds one entry per branch-day → reconnect → `online` listener flushes → cloud matches. If a gap is found, fix minimally.
Test: the airplane-mode scenario above; CloudState ends equal to the device.
Gate: node --check if touched, build bump if touched.

## Task 7 — HQ tab live polling (~30–60s)
Goal: HQ sees near-live across branches without hammering Apps Script.
- Where the HQ dashboard fetches `state_list` (@3197): add polling on an interval of 30000–60000ms while the HQ tab is visible; also refresh on tab open and on a manual refresh button. Clear the interval when leaving the HQ tab. Do not poll faster than 30s.
Test: change a branch on a writer device → HQ dashboard reflects it within one interval.
Gate: node --check, build bump.

## Task 8 — delete dead code
Goal: remove the merge machinery now that nothing uses it.
- Simplify `migrateBranchKeys` (@3010) to stop using `activityScore` (prefer the non-empty state, else the newer `lastSaved`). Then delete `activityScore` (@1034) entirely.
- Remove any now-unused merge locals/comments.
Test: node --check passes; app loads; a legacy non-canonical date key still consolidates correctly.
Gate: node --check, build bump. Then move `docs/plans/2026-08-18-deploy-v12-and-field-test.md` context forward and update `docs/HANDOFF.md`.

---

## Rollout
1. Ship through Task 4 with every device defaulting to writer (no behavior change) except Tony's HQ device set to viewer after Task 2.
2. After Task 5, watch one branch for a day via the CloudState sheet — its row should track the device; HQ view should match.
3. Then enable/observe the rest. Roll back any single task by reverting its commit; tasks are independent enough to bisect.

## Capture on completion
Append to `docs/capture_log.md`: whether removing the merge (vs a 6th patch) actually ended the mismatch in the field, and any edge that surfaced during rollout.
