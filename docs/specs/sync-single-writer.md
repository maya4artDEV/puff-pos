# Spec: single-writer sync (kill the cross-device mismatch)

Status: DRAFT — review before planning. No code yet.

## Problem
Devices show different stock/sales for the same branch-day. "Fixed" 5 times; still broken in the field. Current workaround ("open both devices at once") is impossible for branches 1,000 km apart.

## Root cause
The app lets **every** device both write and read a branch-day, then reconciles copies with a **merge** (`activityScore` / `scoreState` / empty-state guards). Multi-writer merge is a genuinely hard distributed-systems problem; the 5 "fixes" were all patches on that merge. The merge is the bug, not a thing to patch a 6th time.

## Decisions locked (from Tony)
- **1 device per branch** (the branch tablet) — single writer.
- **HQ device = read-only** (aggregates/views + tax). It never edits a branch's daily sales. (Answer: model A.)
- **Offline required** — branches have unstable internet; must sell offline.

## Goal
For any branch-day, exactly one device (that branch's tablet) is authoritative. Cloud mirrors it. Every other device reads cloud and never writes. Result: no merge, no mismatch, offline still works.

## Non-goals (separate specs — do NOT bundle)
- HQ yearly tax-period reset/archive.
- Tax invoice (ใบกำกับภาษี) printing — has Thai Revenue-Department field requirements + PDPA.
- Receipt printer / cash-drawer hardware — browser↔thermal-printer is platform-limited (Web Bluetooth: Android yes, iPad no). Decide tablet OS first.

## Design

### 1. Device role (new)
Add a device-level role stored once at setup: `puff7_device_role` = `"branch"` | `"viewer"`.
- `branch`: owns exactly one branch (the branch already chosen at login). May write **only** its own branch's CloudState.
- `viewer` (HQ, any other device): cloud writes **hard-disabled** everywhere.
Role is chosen at setup/login; show it clearly in the UI so a device is never silently the wrong role.

### 2. Write path — branch device only
- On save: write localStorage first (instant, offline-safe), then push to cloud as an **authoritative upsert** of the full state for `branch+date`. No merge, no score check — the sole writer's state *is* the truth.
- Offline: mark the branch-day dirty and queue it; flush on `online` / `pageshow` / `visibilitychange`. Latest push wins (safe, because nobody else writes this branch).

### 3. Read path — all devices
- Branch device: local is truth for its branch-day. Pull cloud only to **recover** when local is empty (new/cleared tablet) → seed local, then continue as writer.
- Viewer/HQ: always fetch cloud and display. Never write. No local authority, no merge.

### 4. Remove (net deletion, not addition)
- `activityScore` (client) and `scoreState` rejection (server) — obsolete once there's one writer.
- Empty-state poisoning guards — the poisoning was viewer devices writing empties; viewers no longer write, so the cause is gone. Keep one cheap server-side belt: ignore writes whose role ≠ branch-for-that-branch.
- Keep `normDateStr()` (still needed for correct keys) and `getStockForState()` (SSOT accessor).

## Affected code (confirmed present in index.html)
`activityScore`, `getSyncURL`, `prefetchCloudState`, `refreshFromCloud`, `isEmptyState`, plus the `state_save` call and login/branch-selection block. Server: `Code_Owner_v7.gs` / `Code_Franchise_v7.gs` `state_save` handler + `scoreState`.

## Edge cases
- **Tablet replaced / cache cleared mid-year:** local empty → pull cloud for the day → seed → resume. Cloud holds its own last push, so nothing is lost.
- **Transition period (before tablets arrive):** if two devices are both role=branch for one branch, conflict returns. Operational rule during rollout: exactly one device per branch is role=branch; everything else is viewer.
- **Two branch tablets, wrong branch code:** role=branch is scoped to one branch; a device can only write the branch it's set to. Guard on server by branch too.
- **Clock skew / offline for hours:** fine — single writer means "latest full-state push" is always correct; no timestamp races.

## Rollout (production, ~20 branches nationwide)
1. Ship behind the role setting; default existing devices to `viewer` EXCEPT the known branch device, to avoid accidental writes.
2. Verify remotely via the CloudState sheet (no site visits): after a branch sells, its row updates; HQ view matches.
3. Watch one branch for a day before enabling all.

## Open questions (resolve before PLAN)
1. How is a device assigned role=branch in the field — at login (pick branch + "this is the branch tablet"), or a one-time setup screen? Need the exact current login flow to wire it.
2. Does HQ need to see **today live** across all branches, or is end-of-day enough? (affects read frequency / Apps Script quota.)
3. During transition, are staff phones still used to sell at some branches? If yes, how do we prevent two role=branch devices per branch?
