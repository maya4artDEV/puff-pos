# SPEC — Issue 3: Business-Day Cutoff / Late Close (Rec C nudge)

Status: **SPEC — decisions to lock before PLAN.** No code yet. `index.html` client-only (no `.gs`).
Grounded in the live data model (verified against build 0004 `d5efa714`), not hand-waved.

## Problem
Event branches often finish and clear the stall after midnight (~2am). The app cuts the day at the calendar boundary — `todayISO()` (L3910) is the Bangkok calendar date — and the editable state `S` is always **today's** key (`puff7_{safeBranch}_{todayISO}`). So when staff open the app at 2am to reconcile, the app has already rolled to the new day and yesterday's takings can't be entered/closed. Past days are effectively view-only because `S` only ever loads today's key.

**Interim mitigation (already available, zero-code):** don't reload/close the app until the day is reconciled — the in-memory `S` stays on the correct day. Keep telling branches this until the fix ships.

## What already exists (do NOT rebuild)
- **Close marker:** `S.is_closed` (bool) + `S.closedAt` (ts), set by `confirmCloseDay` (L5596). `renderCloseDayStatus` reflects it (L5556).
- **Carry-over prefers closed day:** new-day init runs Pass 1 = latest state with `is_closed === true`, Pass 2 = latest state fallback (L3968–3987). So an unclosed yesterday still feeds today via the fallback — meaning today may already have carried from an *unclosed* base.
- **History view** (`renderHist` L5603) already lists past-day keys read-only.

## Decision (locked)
**Rec C — nudge on open.** On app open, if the immediately-previous calendar day is unclosed and has real activity, prompt: *"ยังไม่ได้ปิดวันเมื่อวาน {date} — ปิดตอนนี้ไหม?"* → accept loads yesterday for the close flow; skip dismisses. Chosen over A (global cutoff offset — biggest blast radius, touches every date read) and B (always-editable past days — invites accidental edits).

## Decisions to lock before PLAN
| # | Decision | NOVA recommendation | Needs Tony? |
|---|----------|---------------------|-------------|
| 3-D1 | What counts as "unclosed yesterday"? | yesterday key exists **AND** `is_closed !== true` **AND** has activity (any of `sales`/`fry_log`/`gift_sales`/`delivery_sales` non-empty). Empty carry-only days never nudge. | confirm |
| 3-D2 | When does the nudge fire? | Only for the **immediately previous** calendar day, and only once — remember dismissal in `puff7_closeNudge_{branch}_{date}` so it never nags twice. No time-window gate (2am close means the window is unpredictable). | **decide** |
| 3-D3 | On accept, how editable is yesterday? | Load yesterday's key as active `S` (fully editable for the close — staff may need to fix counts), jump to close-day page. Scoped Option-B-by-nudge; today's `S` restored after. | **decide** |
| 3-D4 | Sync date when closing yesterday | Close/save/sync must use `S.date`, **not** `todayISO()`. ⚠️ `queueCloudSync(currentBranch, todayISO(), S)` at **L4055 hardcodes todayISO** — this MUST become `S.date`-aware or a late close pushes under the wrong date. Core of the PLAN. | confirm |
| 3-D5 | Carry-over correction after late close | If today has **no activity yet**, re-derive today's opening stock/price/gift from the now-closed yesterday. If today already has activity, leave it (don't clobber). | **decide** |
| 3-D6 | Return-to-today UX | After close (or skip), restore `S` to today's key + land on the normal home page. | confirm |

## Risks / blast radius
- **L4055 `todayISO()` hardcode (3-D4)** is the single riskiest edit — it's on the sync path. Get this wrong and late-closed data lands on today's sheet row. PLAN will isolate + round-trip test it.
- **Day-switch of active `S`** is the second risk: every render/save assumes `S` is today. Loading yesterday temporarily means the save/sync path must key off `S.date` consistently. Audit needed for every `todayISO()` in the write/sync path (`grep` shows L3941 default, L4055 sync, L5867 export, L5934, L6456) — not all need changing, but each must be classified before coding.
- Carry-over (L3968) already prefers `is_closed` — a late close *improves* tomorrow's base automatically; the only gap is **today**, handled by 3-D5.

## Test scenarios (for the eventual PLAN)
- T1: yesterday has sales, unclosed, open app today → nudge shows with yesterday's date.
- T2: accept → land on yesterday's close page, counts/cash editable, close → `is_closed` set on **yesterday's** key.
- T3: verify sync pushed under **yesterday's** date (round-trip: check sheet row date + cloud key).
- T4: skip → no nudge again same day (dismissal remembered); today unaffected.
- T5: yesterday empty (carry-only) → no nudge.
- T6: yesterday already closed → no nudge.
- T7: after late close, if today had no activity → today's opening stock matches closed-yesterday leftovers.
- T8: today already had activity before the nudge → today NOT clobbered.

## Deliverable after decisions
NOVA writes `PLAN-issue3-business-day.md` with exact `str_replace` edits + baseline/target MD5 + `node --check`, isolating the L4055 sync-date change and the day-switch loader. Antigravity executes; NOVA re-audits MD5 independently.

**Blocking on:** Tony's calls on 3-D2, 3-D3, 3-D5 (three ⚠️/decide rows). The rest are confirm-only.
