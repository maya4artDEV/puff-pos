# SPEC — Per-Branch Login Access Control

- **ID:** branch-access
- **Severity:** HIGH (live exposure, production, 20+ branches)
- **Status:** SPEC — awaiting Tony's confirm on D1 before PLAN
- **Author:** NOVA (tech-lead)
- **Files touched:** `index.html` (client), owner `.gs`, franchise `.gs`
- **Base build:** `20260823.0216` (MD5 `C7A63683E607FED00E7AFC55411BCD44`, durian-complete, not yet deployed)
- **Related:** DUR-001 (durian) — deploy together, one `.gs` redeploy round each script

---

## 1. Problem & threat model

POS login has **no per-branch authentication**. Anyone with the app link can pick any owner
branch from `loginBranchSel` (SBR-01 / TBK-02 / MVK-03 / WNY-04 / BPI-05) or type any code in
`loginFreeInput` and immediately view + write that branch's data. Only gate today is `HQ_PIN`
(cross-branch HQ tab only) — it does not cover branch-level login.

- **Threat 1 (real, MVP target):** person opens the app UI → selects/types another branch →
  views/edits. Closed by client login gate + server `branch_auth`.
- **Threat 2 (advanced, Phase 2):** person POSTs directly to the exec URL with a branch code,
  bypassing the UI. `state_save` / `state_get` / `sale` / `fry` still accept unauthenticated
  writes. **Out of scope here** — endpoint hardening is a separate phase.

**MVP = close Threat 1** (matches the actual exposure Tony observed).

---

## 2. Goal

A branch that is **registered** server-side requires a correct **PIN** before `setBranch()`
succeeds. Unregistered branches stay open (unchanged behavior). PINs never live in the client.

---

## 3. Decisions

| # | Decision | Choice | Note |
|---|----------|--------|------|
| **D1** | Which branches gated at launch | **Owner 5 registered; franchise opt-in** | ⬅ **CONFIRM.** List any franchise codes to also register at launch. |
| D2 | Where PINs live | `PropertiesService` `BRANCH_PINS` (JSON) per script | Owner branches → OWNER script. Franchise codes → FRANCHISE script. Route by `getSyncURL`. Never in repo/client. |
| D3 | Who sets PINs | **Tony only** (manual, in Apps Script editor) | No self-set (first-write-wins = security + typo-split hole). UI management deferred. |
| D4 | Session | **Remember-until-logout** per device | Single-writer-per-branch: PIN once on the branch device, persists until explicit logout. |
| D5 | Switch branch | **Logout + re-auth** | Locking to the authed branch; changing branch clears session. |
| D6 | Unregistered branch (incl. `E`-events, franchise not in map) | **Open pass-through** | Preserves frictionless entry; matches Tony's "no franchise registry" intent. |
| D7 | Typo / branch-code collision | **Out of scope** | Pre-existing. Existing `loginFreeNote` warning + staff guide. Optional "recent branches" chip = separate ticket. |

**Uniform rule (both scripts):** `BRANCH_PINS[branch]` exists → require matching PIN; else → open.

---

## 4. Server contract (`branch_auth` handler — both `.gs`)

Mirror the existing `hq_auth` handler: **short-circuit before `openById`**.

**Request** (POST, `text/plain;charset=utf-8`, routed via `getSyncURL(branch)`):
```
{ "type": "branch_auth", "branch": "SBR-01", "pin": "1234" }
```

**Logic:**
```
pins = JSON.parse(PropertiesService.getScriptProperties().getProperty("BRANCH_PINS") || "{}")
if (!(branch in pins))            -> { ok: true, open: true }   // unregistered = open (D6)
if (pins[branch] === String(pin)) -> { ok: true }               // correct PIN
else                              -> { ok: false }              // wrong / missing PIN
```

**Notes**
- `BRANCH_PINS` set manually per script (owner keys in OWNER, franchise keys in FRANCHISE).
- `TG_BOT_TOKEN` stays `""` in repo — unchanged, do not touch.
- Franchise `.gs` still lacks `gift_sale` handler — unrelated, do not touch in this task.
- Constant-string compare is fine for Threat 1; no timing-attack hardening needed at MVP.

---

## 5. Client flow (`index.html`)

### 5.1 New UI
- Add `loginPinInput` (type `tel` or `password`, `autocomplete="off"`, session-only, never
  written to localStorage) to the login card, below the branch selector group.
- Optional UX hint: when an owner preset is selected, show "ต้องใส่รหัสสาขา"; blank allowed for
  open franchise (server decides). Single code path — do not branch the UI by branch type.

### 5.2 Gate insertion point
Current `doLogin()` path:
```
validate name/nick/phone/_loginBranch
  -> prefetchCloudState(_loginBranch, cb)
       -> setBranch(_loginBranch) + show mainApp
```
Insert **branch_auth BEFORE prefetch/setBranch**:
```
validate ...
  -> if hasValidBranchSession(_loginBranch): proceed (skip PIN)
  -> else POST branch_auth to getSyncURL(_loginBranch) with loginPinInput value
       ok  -> store branch session -> prefetchCloudState -> setBranch -> mainApp
       fail-> showToast("รหัสสาขาไม่ถูกต้อง", true); re-enable loginBtn; clear PIN
       error-> showToast("เชื่อมต่อไม่ได้ ลองใหม่", true); re-enable
```
No change to `setBranch()` internals, `prefetchCloudState`, routing, or state schema.

### 5.3 Session (mirror `checkHQAuth` shape, no 8h expiry)
- Key: `puff10_branchAuth` = `{ branch: <code>, ts: <ms> }`.
- `hasValidBranchSession(b)` = stored exists **and** `stored.branch === b`.
- `doLogin`: if valid session for `_loginBranch` → skip branch_auth POST.
- `doLogout`: `localStorage.removeItem("puff10_branchAuth")` (add to existing logout).
- DOMContentLoaded restore (~5914): if `lastBranch` has valid session → may auto-fill/skip PIN;
  otherwise PIN required. Restore must not silently bypass the gate for a non-matching branch.
- **Security note:** client session flag is a UI convenience (Threat 1). It does not protect
  Threat 2 — consistent with the `hq_auth` model.

### 5.4 Build stamp (bump all 3 — non-negotiable)
- meta `~line 12`
- title `~line 13`
- `#buildVer` `~line 3450`
New stamp: bump to a fresh `YYYYMMDD.HHMM`.

---

## 6. Rollout (HIGHEST RISK — live branches)

On deploy day, every branch currently in use is locked out the moment the client ships **unless
its PIN is already set**. Sequence is mandatory:

1. **Set `BRANCH_PINS` in OWNER script** for all 5 owner branches (+ any franchise codes from D1).
2. **Set `BRANCH_PINS` in FRANCHISE script** for any registered franchise codes (D1). If none → skip.
3. **Redeploy both `.gs`** as *New version* (branch-access + durian together — one round each).
4. **Distribute each branch its PIN + notify** (Tony) — confirm receipt before step 5.
5. **Push client** (`index.html`) to GitHub Pages.
6. Verify one owner + one open franchise login on a real device.
7. **Update staff guide v3** — add "รหัสผ่านสาขา" section.

Deploy order rule: **PINs live → both `.gs` deployed → client pushed.** Never client-first.

---

## 7. Out of scope
- Threat 2 endpoint hardening (Phase 2).
- Franchise self-service PIN / in-app PIN management.
- Typo / branch-code collision fix (D7 — separate ticket).
- Franchise `gift_sale` handler (unrelated known gap).

---

## 8. Test scenarios (SPEC-level; execute in PLAN)
- T1: owner branch + correct PIN → login OK, data loads.
- T2: owner branch + wrong PIN → rejected, stays on login, PIN cleared.
- T3: owner branch + blank PIN → rejected.
- T4: unregistered franchise code → login OK (open pass-through, no PIN needed).
- T5: registered franchise + correct/wrong PIN → OK / rejected.
- T6: valid session same branch → PIN skipped on re-open.
- T7: switch to a different branch → forced re-auth.
- T8: logout → `puff10_branchAuth` cleared → PIN required next login.
- T9: offline / server error on branch_auth → clear error toast, no login, no data leak.
- T10: `node --check` clean, brace balance, build stamp bumped in 3 spots.

---

## 9. Gate to PLAN
- **Confirm D1** (which branches registered at launch).
- **Attach current `owner.gs` + `franchise.gs`** — PLAN needs the real `hq_auth` block to write
  surgical `str_replace` for the `branch_auth` handler. SPEC-level contract is complete without
  them; PLAN is not.
