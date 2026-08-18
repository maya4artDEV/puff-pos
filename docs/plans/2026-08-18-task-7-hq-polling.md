# PLAN: Task 7 — HQ Dashboard live polling (60s interval)

Client-only. No Apps Script changes.
Conventions same as PLAN Task 1–8: view first, surgical `str_replace`, `node --check` PASS, bump build stamp (3 spots), commit, stop for review.

Grounding (verified on build 20260818.2010):
- HQ dashboard fetch at line 3290 (`state_list`), rendered by `renderHQDashboard()` @3282.
- Tab entry via `go("hq")` → `renderHQTab()` @3227 → auth gate → `renderHQDashboard()` when authed.
- Tab switch handled centrally by `go(tab)` @1351 — any tab change goes through this.
- No polling anywhere in the codebase currently.

## Design (small, surgical)

Add ONE polling loop that:
- Ticks every **60,000 ms**.
- Runs **only** while the HQ tab is the current tab.
- Runs **only** when HQ is authenticated (`_hqAuthed === true`).
- Runs **only** when the tab is browser-visible (skip when phone locked/backgrounded — spares quota).
- Uses the same `state_list` fetch code path the manual refresh already uses (do not duplicate rendering logic).
- Never overlaps itself (a previous poll in flight must complete before the next starts).

## Sub-task A — extract the fetch+render body into a reusable function
Goal: don't fork rendering logic between manual-refresh and poll.
- In `renderHQDashboard(pg)` @3282, keep the initial "loading…" scaffold as-is.
- Extract lines 3290–end-of-fetch into a new named function `refreshHQData()` that:
  - reads `$("page-hq")` itself (so it can run without an argument later),
  - returns early if `!navigator.onLine`,
  - runs the existing `state_list` fetch + the existing render code unchanged,
  - is safe to call from anywhere.
- Call `refreshHQData()` once at the end of `renderHQDashboard()` — same behavior as today.
- Gate: `node --check`, build bump, commit.

## Sub-task B — polling lifecycle
Goal: start on HQ open, stop on tab leave, don't stack.
- Add module-level:
  ```js
  var _hqPollTimer = null;
  var _hqPolling   = false;   // in-flight guard, mirrors _flushing pattern
  ```
- Add `startHQPolling()`:
  - if `_hqPollTimer` already set → return (idempotent).
  - `_hqPollTimer = setInterval(function(){
        if (currentTab !== "hq") { stopHQPolling(); return; }
        if (!_hqAuthed) return;
        if (document.hidden) return;     // page not visible — skip tick
        if (_hqPolling) return;          // previous still running
        if (!navigator.onLine) return;
        _hqPolling = true;
        refreshHQData(function(){ _hqPolling = false; });
    }, 60000);`
- Add `stopHQPolling()`: `clearInterval` + null the timer + `_hqPolling = false`.
- `refreshHQData` gets an optional `onDone` callback fired in both `.then` (after render) and `.catch`. Do not swallow errors — just release the guard.
- Wire:
  - `renderHQDashboard()` → call `startHQPolling()` after the initial fetch.
  - `go(tab)` @1351 — at the top, before the tab switch runs, if `currentTab === "hq"` and the new `tab !== "hq"` → `stopHQPolling()`. (Also stop on `checkHQAuth()` fail path if reachable.)
- Gate: `node --check`, build bump, commit.

## Not in scope
- No visible "last updated" timestamp on the HQ card. Nice-to-have, separate ticket if wanted.
- No user-facing interval toggle. Fixed 60s per Tony's decision.
- No progress spinner during background polls (only initial load shows "กำลังโหลด…").

## Rollout
- HQ device only (Tony). Zero impact on branch writer devices.
- Quota estimate: 1 viewer × 60 calls/hr × 12 hr = 720 calls/day. Apps Script quota is 20,000/day. Safe by ~25×.

## Capture on completion
Append to `docs/capture_log.md`: whether the poll actually caught branch updates within ~60s in the field, and whether the visibility/tab-switch guards actually stopped it (verify no runaway timer in DevTools → Application → Timers or via `_hqPollTimer` inspection).
