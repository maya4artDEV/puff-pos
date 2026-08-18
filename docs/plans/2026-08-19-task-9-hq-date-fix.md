# PLAN: Task 9 — HQ date normalization + viewer full lockdown

Fixes 4 bugs surfaced by the batch test on build 20260819.0018.

## Bugs

### BUG-1 — viewer still fires Telegram (Part 2 findings)
- `sale/fry/gift_sale/delivery_sale` are fire-and-forget POSTs (not queued). Task 2 gated only the queue, so viewer devices still POST audit events → Apps Script sends Telegram.
- Sync is not affected (state_save is blocked). But the semantics were wrong: viewer should be read-only, period.

### BUG-2 — HQ shows stale rows (Part 6, Part 8)
- `renderHQData` picks the "latest" row per branch with a string comparison on Thai-format dates (`"19/08/2569"`). String compare of `dd/MM/yyyy` is arithmetically wrong: `"19/08" < "31/07"` because `"1" < "3"`.
- Result: HQ always shows an older row for a branch whose current-date starts with a smaller day-digit than any previous date. Today's data never surfaces.

### BUG-3 — SBR-01 shows ISO date from the future
- Some legacy row stored `s.date` as a JS-serialized ISO string (`"2569-12-07T17:00:00.000Z"`). Under string compare it beats every `dd/MM/yyyy` value indefinitely, so SBR-01 is permanently pinned to that garbage row.
- Root: pre-`normDateStr` era saved this shape. Cleanup + defensive parsing needed.

### BUG-4 — "วันนี้" badge never triggers on non-canonical rows
- `isToday = s.date === today` is a strict string equality. If either side is ISO or non-zero-padded, it never matches.

## Fixes (client-only; no Apps Script redeploy needed)

### Sub-task A — viewer full POST lockdown
Add `if (getDeviceMode() === "viewer") return;` at the top of each fire-and-forget POST:
- `delivery_sale` (@1719)
- `sale` (@1972)
- `fry` (@2118)
- `gift_sale` (@2908)

Match the Task 2 pattern exactly. Do not touch the queue.

Effect: viewer devices become truly read-only. Telegram will not fire from a viewer.

### Sub-task B — canonical date helper + HQ pick fix
Add one helper near `normDateStr` (~line 964):

```js
// Convert any accepted date shape to a sortable canonical "yyyymmdd" integer.
// Accepts "dd/mm/yyyy" (Thai display) or ISO "yyyy-mm-dd..." (legacy/JS-serialized).
// Returns 0 for anything unrecognisable, which sorts to "oldest" — the safest default.
function dateSortKey(ds) {
    var s = String(ds || "");
    // ISO first ("2569-12-07..." or "2025-08-19..."): grab the yyyy-mm-dd head
    var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return parseInt(iso[1] + iso[2] + iso[3], 10);
    // dd/mm/yyyy (with or without leading zeros)
    var p = s.split("/");
    if (p.length === 3) {
        var d = parseInt(p[0], 10) || 0;
        var m = parseInt(p[1], 10) || 0;
        var y = parseInt(p[2], 10) || 0;
        if (d && m && y) return y * 10000 + m * 100 + d;
    }
    return 0;
}
```

Then in `renderHQData` (~line 3329) change:
```js
if (!byBranch[s.branch] || s.date > byBranch[s.branch].date) byBranch[s.branch] = s;
```
to:
```js
if (!byBranch[s.branch] || dateSortKey(s.date) > dateSortKey(byBranch[s.branch].date)) byBranch[s.branch] = s;
```

### Sub-task C — canonicalise displayed date + "วันนี้" badge
In `renderHQData` (~line 3334): replace `s.date` used for display and comparison with `normDateStr(...)` where meaningful, and change the `isToday` line so it normalises both sides.

Concretely:
```js
var sDateCanon = normDateStr(s.date);       // "19/8/2569" -> "19/08/2569"; ISO -> untouched-but-that's-ok
var isToday = sDateCanon === today;
// where date shows: use sDateCanon instead of s.date so ISO garbage doesn't leak into UI
```

Note: `normDateStr` currently only handles `dd/m/yyyy → dd/mm/yyyy`. For ISO input it returns the string as-is. That is acceptable — ISO rows will display as-is and never match `today`, which is honest ("we can't tell when this is") rather than lying with a green badge.

### Sub-task D — cleanup guidance (no code change)
The ISO row on SBR-01 will keep polluting the sort until it ages out. Two options; user picks:
1. Leave it — with `dateSortKey`, an ISO year 2569 still sorts near the top so it will still win. **Not good enough.**
2. In `dateSortKey`, cap ISO years above a plausible present (e.g. treat any date > today + 1 day as 0). Feels hacky; documents the assumption "we don't operate 4 months in the future".
3. Manually delete the offending row in the Owner CloudState sheet: filter `branch = SBR-01 AND date starts with 2569-12`, delete row. Cleanest.

Recommendation: **do #3 (manual sheet cleanup)** as a one-time operation after Sub-tasks A-C ship, then verify HQ shows today's data.

## Gates (per sub-task)
- `node --check` PASS (0 errors).
- Brace balance stable.
- Bump build stamp 3 spots (single bump for all sub-tasks if shipped together — bugs are related).
- Commit each sub-task separately for bisect.

## Test after ship
- **Viewer lockdown:** Set device = viewer → make a sale → verify no Telegram fires AND no request to Apps Script in DevTools Network.
- **HQ freshness:** After a writer records a sale today, HQ (any polling tick) should surface today's row within 60s. Check the "วันนี้" badge appears with the mustard color.
- **SBR-01 recovery:** After the manual sheet cleanup + one writer save today, SBR-01 card should show today's date and today's totals.

## Not in scope
- Rewriting `normDateStr` to handle ISO. Kept minimal — `dateSortKey` handles the sort concern, display of a stray ISO row is honest for one refresh cycle after cleanup.
- New backend event types. All client fixes.
