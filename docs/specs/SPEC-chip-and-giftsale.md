# SPEC — Recent-Branches Chip (A) + Franchise gift_sale (B)

Two independent small features. Can ship separately. Base build after branch-access: `20260825.0002`.

---

## A) Recent-Branches Chip (client-only)

### Problem
Franchise staff retype their branch code in `loginFreeInput` every session. One typo = data written under a wrong branch key (silent split). Existing mitigation = the `loginFreeNote` warning only.

### Goal
After a successful login on a **franchise/event** code, remember it on-device and show it as a tappable chip below the free-text input, so returning staff tap instead of retype.

### Decisions (locked)
- **D-A1:** Keep the **5 most recent** codes (most-recent-first, deduped).
- **D-A2:** **Per-device only** — `localStorage`, no cloud sync. Matches single-writer-per-branch.
- **D-A3:** Each chip has a **remove (✕)** affordance to forget a mistyped/stale code.
- **D-A4 (derived):** Only **franchise/event** codes are stored — never the 5 preset owner branches (they're already in the dropdown; a chip would be noise). Filter: if code is in `BRANCH_CODES`, skip.

### Data
- Key: `puff10_recentBranches` (new; no collision — verified against existing `puff10_*` / `puff8_*` keys).
- Value: JSON array of code strings, newest first, max 5. e.g. `["CM-PTT01","E-SIAM02"]`.

### Where it hooks (grounded)
1. **Save** — in `doLogin`, inside the `branch_auth` success path, right where the session is saved:
   `if (d && d.ok) { setBranchAuth(_loginBranch); pushRecentBranch(_loginBranch); finishLogin(); }`
   `pushRecentBranch` skips codes present in `BRANCH_CODES` (owner presets) → only franchise/event stored.
   Note: the session-skip fast-path (`hasValidBranchSession`) already logged-in returns early and does **not** re-save — acceptable, the code is already the most recent from its first login.
2. **Render** — new `renderRecentChips()` called:
   - once at login screen init (end of `DOMContentLoaded`, after existing restore ~L5956),
   - and at the end of `onLoginFreeInput()` (so the list stays visible while typing).
   Chips render into a new container `#loginRecentChips` placed directly under the `loginFreeNote` div inside the franchise `lf-group`.
3. **Tap a chip** → set `loginFreeInput.value = code`, call `onLoginFreeInput()` (reuses existing path that sets `_loginBranch` + clears dropdown + `updLoginBtn()`).
4. **Tap ✕** → remove that code from `puff10_recentBranches`, re-render chips.

### Helpers (ES5, new)
```
function getRecentBranches()      // parse array or []
function pushRecentBranch(code)   // skip if in BRANCH_CODES; unshift, dedupe, cap 5, save
function removeRecentBranch(code) // filter out, save
function renderRecentChips()      // el()-built chips into #loginRecentChips; onclick via closure
```
All DOM via `el()`. onclick via closure per existing pattern (e.g. gift rows). No `innerHTML`.

### UI
- Reuse existing token look: small pill, `lf-*` palette. New CSS class `.lf-chip` + `.lf-chip-x` (scoped, additive — does not touch existing rules).
- Chips hidden when list empty (container simply renders nothing).

### Out of scope
- No owner-branch chips (D-A4). No cloud sync (D-A2). No rename/edit — remove + re-login is the correction path.

### Build / audit
- Bump stamp `20260825.0002` → `.0003` (×3).
- `node --check` clean · brace balance · `grep -c puff10_recentBranches` == expected · new fns present · MD5 target from NOVA after local pre-validate.

### Test
- T-A1: login franchise `CM-PTT01` → logout → chip `CM-PTT01` shows under free input.
- T-A2: tap chip → free input fills, login button enables.
- T-A3: 6 different franchise logins → only latest 5 chips, oldest dropped.
- T-A4: login owner `SBR-01` → no chip created.
- T-A5: tap ✕ on a chip → chip gone, persists after reload.
- T-A6: dedupe — re-login existing code → moves to front, no duplicate.

---

## B) Franchise `gift_sale` Handler (server)

### Problem
Owner `.gs` has a `gift_sale` handler (owner L129); franchise `.gs` does **not**. Franchise gift-item sales don't reach the franchise sheet — a known gap flagged since the POS state doc.

### Goal
Mirror the owner `gift_sale` handler into franchise `.gs` so franchise gift sales log identically to their own sheet.

### Decisions (to confirm)
- **D-B1:** Mirror owner logic **exactly** (same columns/sheet-tab pattern, writing to the franchise `SHEET_ID`)? → rec: yes, uniform.
- **D-B2:** Deploy timing — **not** bundled with a rushed redeploy. branch-access + durian just shipped; deploy B in the next planned `.gs` round (or standalone when convenient).

### Where it hooks (grounded)
- Franchise `.gs` `doPost` router — insert `gift_sale` block in the same relative position owner has it (after `sale` / `fry`, before `delivery_sale`), so ordering matches owner.
- Uses franchise `SHEET_ID` (already defined). `TG_CHAT_ID` present; `TG_BOT_TOKEN=""` untouched.

### Gate to PLAN
- Attach the **current** franchise `.gs` (the one now deployed **with** `branch_auth`) so PLAN targets the live baseline, not the pre-branch-access copy.
- Confirm D-B1 (exact mirror) + D-B2 (deploy timing).

### Build / audit
- CRLF preserved · `TG_BOT_TOKEN=""` stays empty · copy `.gs`→`.js` `node --check` · `grep -c gift_sale` == 1 · MD5 target from NOVA.

### Test (deploy-day)
- T-B1: franchise records a gift sale → row appears in franchise sheet, format matches owner.
- T-B2: franchise Telegram notification fires (if owner's does).
- T-B3: existing franchise `sale`/`fry`/`delivery_sale` unaffected.

---

## Suggested order
A (client-only, zero deploy risk, closes the typo pain) first. B waits for the next franchise `.gs` deploy window to avoid stacking redeploys right after branch-access.
