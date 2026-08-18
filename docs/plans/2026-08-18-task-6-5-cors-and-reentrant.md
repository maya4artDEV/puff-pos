# PLAN: Task 6½ — CORS + verifiable POSTs + re-entrant guard

Executes the "option C + text/plain" decision from Aug 18. Client-side only. No Apps Script changes needed — server already reads `e.postData.contents` and JSON-parses it (verified in the Task 5 redeploy).

Conventions same as PLAN Task 1–8: view first, surgical `str_replace`, `node --check` PASS, bump build stamp (3 spots), commit, stop for review before the next sub-task.

Grounding (verified on build 20260818.1905):
- 4 POSTs use `mode:"no-cors"` — line 1972 (sale), 2118 (fry), 2908 (gift_sale), 3068–3069 (state_save queue flush).
- GET calls to `state_latest` (3126) and `state_list` (3275) already read `r.json()` — proves the Apps Script exec URL is fetchable with a real (non-opaque) response from the browser.
- Queue enqueue: `queueCloudSync` @3043; flush: `flushSyncQueue` @3058. No re-entrant guard.

---

## Sub-task A — flip 4 POSTs to text/plain + real response reads
Goal: server can be reached with a readable response; client stops presuming success.
- Change every `mode:"no-cors"` (4 sites) to `mode:"cors"` and change `Content-Type` from `application/json` to `text/plain;charset=utf-8`. Body stays the same JSON string — server side is unchanged.
- For **`flushSyncQueue`** (the queue drain @3068): rewrite the `.then(function(){ remove-from-queue })` chain to actually check the response:
  - `.then(function(r){ return r.json(); })`
  - `.then(function(d){ if (d && d.ok) { remove-from-queue and recurse } else { keep in queue; call updateSyncIcon; do not recurse } })`
  - `.catch(function(){ keep in queue; updateSyncIcon })` — network fail keeps the item, unchanged from today.
- For **sale / fry / gift_sale** (fire-and-forget POSTs, no queue): keep them fire-and-forget; add a `.catch(function(){})` if not present. Do not build a new queue for them in this sub-task.
- Test scenario (Tony, when we batch tests): normal sale online → Sheet gets the row; unplug wifi → sale still stored locally, queue holds it; reconnect → cloud updates and queue clears.
- Gate: `node --check` PASS, brace balance, build stamp bumped, commit.

## Sub-task B — re-entrant guard on flushSyncQueue
Goal: two concurrent flush chains can't run.
- Add module-level `var _flushing = false;`
- At the top of `flushSyncQueue`: after the viewer belt, if `_flushing` → return; else `_flushing = true`.
- In the `.then` success branch, before recursing: leave `_flushing = true` (recursion drains one at a time).
- When the queue empties, on `.catch`, and on the viewer belt: set `_flushing = false`.
- Verify the flag is reset on every exit path — a stuck `_flushing = true` freezes sync forever.
- Test: rapid online/offline toggle → only one chain in flight; queue still drains cleanly.
- Gate: `node --check` PASS, brace balance, build stamp bumped, commit.

## Rollout
1. Ship A first, verify queue still drains normally on a writer device (single sale online).
2. Then B. It's tiny and independent — merging together is also fine, but two commits give easier bisect if anything regresses.
3. Both are client-only: no Apps Script redeploy, no Sheet touch.

## Not in scope for 6½
- Building a queue for sale/fry/gift audit POSTs. Silent-loss on those still exists but is unchanged pre-existing behavior, and not the bug we're closing. Follow-up task if we ever want durability there.
- Changing Apps Script return payloads. Current handlers return `{ok:true}` already — we're just starting to read it.

## Capture on completion
Append to `docs/capture_log.md`: whether `text/plain` + `cors` worked cleanly on the deployed exec URL (following the 302 redirect), and any browser that misbehaved on real devices.
