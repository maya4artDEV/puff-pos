# PLAN — Issue 3: Business-Day Late-Close (Rec C nudge) · puff-pos

Status: **READY TO EXECUTE.** Client-only (`index.html`, no `.gs`). Grounded + re-audited on build **0009**.

| | value |
|---|---|
| Baseline MD5 (0009) | `441a9ed9cf85188bf3f9fedd7db602fd` ✅ verified |
| Target MD5 (0010) | `e00c632f7e0c4d8a60f1c3f1aac067ca` |
| `node --check` | **EXIT 0** (brace balance 0, paren balance 0) |
| Diff surface | 64 lines — 55 = one inserted nudge block, 9 = tiny in-place edits |
| Build stamp | `20260919.0009` → `20260920.0010` (×3 sites) |

Decisions locked by Tony: **3-D2 / 3-D3 / 3-D5 = confirm SPEC (Rec C).** 3-D7 (email date) = **defer, keep `todayISO()`** for MVP.

---

## 0. Root cause (re-audited on 0009)
`save()` writes **both** its local key **and** its cloud-sync key from `todayISO()`, ignoring `S.date`:
```
L4050  localStorage.setItem(stateKey(currentBranch), payload);   // stateKey() default → todayISO()
L4052  queueCloudSync(currentBranch, todayISO(), S);             // hardcoded todayISO()
```
The moment `S` holds any non-today day (late close of yesterday), save corrupts the wrong key. **SPEC (grounded on 0004) named only the cloud half (L4055). The local half (L4050) was missed — the bug is 2 adjacent lines, not 1.** Fixing `save()` to key off `S.date` is a correctness fix independent of Rec C.

`confirmCloseDay()` (L5615) and `queueCloudSync(branch,date,state)` (L6226) need **zero changes** — the former already calls `save()` on the active `S`; the latter already takes `date` as a param and already guards blank pushes via `isEmptyState`. The whole core fix collapses into `save()` + a small nudge harness.

## 1. New findings NOT in the SPEC (important)

**F1 — `isEmptyState` is the WRONG predicate for "today has no activity" (3-D5).**
`isEmptyState()` (L3996) returns *not-empty* when any `stock[*].received_pieces > 0`. A fresh carry-over day (opening stock carried from yesterday, no sales yet) therefore reads as **not empty**. Using it for 3-D5 would mean today is *never* re-derived after a late close. It would also make the nudge misfire on carry-only days.
→ Introduce **`hasDayActivity(st)`** = true only if there are real events (`sales`/`fry_log`/`stock_log`/`gift_sales`/`delivery_sales`/`withdrawals`). Single source of truth for **both** the nudge gate (3-D1) **and** the recompute gate (3-D5). Carried stock ≠ activity.

**F2 — async cloud-prefetch clobber (concurrency).**
`finishLogin()` kicks off `prefetchCloudState(...)`; its callback runs `S = loadBranch(currentBranch)` (**today**) after login settles. If the nudge has swapped `S` to yesterday for a late close, that callback would silently overwrite the back-date session.
→ Guard the callback with `if (_closingPastDay) { updateSyncIcon(); return; }`. (The prefetch's own write is safe: for writers it overwrites local "only if absent or empty", and yesterday-with-activity is neither.)

## 2. `todayISO()` call-site classification (8 sites)
| Line | Role | Action |
|---|---|---|
| 3907 | definition | keep |
| 3938 | `stateKey` default fallback | keep default; write-path callers pass `S.date` |
| 3948 | `newState.date` | keep (new state = today, correct) |
| 3958 | `getPrevDayState` today anchor | keep (carry-over is always "prev vs calendar today"; 3-D5 recompute re-invokes it fresh) |
| **4052** | cloud sync key | **→ `S.date`** ★ |
| 4568 | `calcWeekAvg` exclude-today filter | keep (analytics; correct even mid late-close) |
| 5902 | export filename fallback | keep (cosmetic; caller passes dateStr) |
| 5985 | email report date | keep (3-D7 deferred) |
| 6524 | HQ dashboard highlight | keep (read-only owner view) |
| **4050** | local key (via save, no dateStr) | **→ `stateKey(currentBranch, S.date)`** ★ |
| 4922 | debug alert key (no dateStr) | **→ `S.date`** (diagnostic must show active key) |

---

## 3. Exact edits (11) — `str_replace`, each verified unique-match on 0009

### E1 — build meta (L12)
```
- <meta name="build-version" content="20260919.0009">
+ <meta name="build-version" content="20260920.0010">
```
### E2 — title (L13)
```
- <title>Puff Stick POS v12 · 20260919.0009</title>
+ <title>Puff Stick POS v12 · 20260920.0010</title>
```
### E3 — footer stamp (L3502)
```
-                 build 20260919.0009</div>
+                 build 20260920.0010</div>
```
### E4 — session flag (after L3894)
```
  var _selectedDateOffset = 0;
+ var _closingPastDay = false;   // Issue3: true while nudge-driven back-date close is active
```
### E5 — save() core fix ★ (L4050–4052)
```
- localStorage.setItem(stateKey(currentBranch), payload);
+ localStorage.setItem(stateKey(currentBranch, S.date), payload);
  localStorage.setItem("puff8_lastBranch", currentBranch);
- queueCloudSync(currentBranch, todayISO(), S);
+ queueCloudSync(currentBranch, S.date, S);
```
### E6 — debug key (L4922)
```
- var pk = stateKey(currentBranch);
+ var pk = stateKey(currentBranch, S.date);
```
### E7 — nudge harness (insert between end of `save()` and `function setBranch`)
Insert this block (uses only existing helpers: `stateKey`, `safeBranch`, `normDateStr`, `loadBranch`, `newStateWithCarryOver`, `go`, `showToast`, `todayISO`). All `var` / `function(){}` / `+`-concat — no template literals, no `innerHTML`:
```js
// ── Issue3: business-day late-close (Rec C nudge) ──
function hasDayActivity(st) {
    if (!st) return false;
    return !!((st.sales && st.sales.length) || (st.fry_log && st.fry_log.length) ||
        (st.stock_log && st.stock_log.length) || (st.gift_sales && st.gift_sales.length) ||
        (st.delivery_sales && st.delivery_sales.length) || (st.withdrawals && st.withdrawals.length));
}
function prevDateStr() {
    var d = new Date(); d.setDate(d.getDate() - 1);
    return d.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });
}
function maybeNudgeCloseYesterday() {
    if (!currentBranch) return;
    var yDate = prevDateStr();
    var yKey = stateKey(currentBranch, yDate);
    var dismissKey = "puff7_closeNudge_" + safeBranch(currentBranch) + "_" + normDateStr(yDate);
    if (localStorage.getItem(dismissKey)) return;
    var raw = localStorage.getItem(yKey);
    if (!raw) return;
    var yState; try { yState = JSON.parse(raw); } catch (e) { return; }
    if (!yState || yState.is_closed === true) return;
    if (!hasDayActivity(yState)) return;
    if (confirm("ยังไม่ได้ปิดวันเมื่อวาน (" + yDate + ")\nปิดยอดตอนนี้ไหม?")) {
        enterPastDayClose(yDate);
    } else {
        try { localStorage.setItem(dismissKey, "1"); } catch (e) { }
    }
}
function enterPastDayClose(dateStr) {
    _closingPastDay = true;
    S = loadBranch(currentBranch, dateStr);
    go("close");
    showToast("กำลังปิดยอดวันที่ " + dateStr);
}
function restoreToday() {
    _closingPastDay = false;
    // 3-D5: if today has no real activity, re-derive opening from now-closed yesterday.
    var tKey = stateKey(currentBranch, todayISO());
    var tRaw = localStorage.getItem(tKey);
    var tState = null; try { tState = tRaw ? JSON.parse(tRaw) : null; } catch (e) { tState = null; }
    if (!tState || !hasDayActivity(tState)) {
        var fresh = newStateWithCarryOver(currentBranch);
        try { localStorage.setItem(tKey, JSON.stringify(fresh)); } catch (e) { }
    }
    S = loadBranch(currentBranch);
    go("home");
}
```
### E8 — hook nudge on open (in `finishLogin`, after the rAF nav block)
```
              if (p) p.setAttribute("d", buildNavPath(cx));
          });
      });
+     maybeNudgeCloseYesterday();   // Issue3: prompt to close an unclosed yesterday
      // Non-blocking cloud prefetch: app is usable on local state now;
```
### E9 — guard prefetch callback (F2)
```
  prefetchCloudState(_loginBranch, function () {
      if (!currentBranch) return;
+     if (_closingPastDay) { updateSyncIcon(); return; }   // Issue3: don't clobber back-date close
      S = loadBranch(currentBranch);
```
### E10 — restore-to-today after late close (in `confirmCloseDay`)
```
      renderCloseDayStatus();
      showToast("✓ ปิดวันเรียบร้อย");
+     if (_closingPastDay) restoreToday();   // Issue3: return to today after late close
  }
```
### E11 — reset flag on "today" pill (in `renderDateStrip` onclick)
```
      if (offset === 0) {
          // Click today: reset to live S
          _selectedDateOffset = 0;
+         _closingPastDay = false;   // Issue3: leaving back-date close
          S = loadBranch(currentBranch);
```

---

## 4. Validation (already run on the built target)
- `node --check` on extracted script → **EXIT 0**
- brace balance 0 · paren balance 0
- baseline MD5 `441a9ed9…` confirmed; **target MD5 `e00c632f7e0c4d8a60f1c3f1aac067ca`**
- No `let`/`const`/arrow/template-literal/`innerHTML` in added code · `el()` untouched · localStorage key **format** unchanged (`puff7_{safeBranch}_{normDate}`) — Issue 3 changes the **date value** fed to the key, not the format.

## 5. Test on a real branch (Tony, on device)
| # | Scenario | Expect |
|---|---|---|
| T1 | yesterday has sales, unclosed → open app today | nudge shows with yesterday's date |
| T2 | accept → close page for yesterday, edit counts, close | `is_closed` set on **yesterday's** key |
| T3 | after T2, check cloud/sheet | row filed under **yesterday's** date (not today) ★ |
| T4 | skip the nudge → reopen app | no nudge again (dismissal remembered); today untouched |
| T5 | yesterday = carry-only (opening stock, no events) | **no** nudge (F1: carried stock ≠ activity) |
| T6 | yesterday already closed | no nudge |
| T7 | after late close, today had no events | today's opening = closed-yesterday leftovers (recomputed) |
| T8 | today already had events before nudge | today **not** clobbered |
| T9 | normal same-day close (no nudge path) | unchanged behavior (`_closingPastDay` stays false) |

## 6. Deploy
- Client = **MD5-gated file-swap.** After edits, verify `md5 == e00c632f7e0c4d8a60f1c3f1aac067ca` before pushing.
- Either: Antigravity applies E1–E11 in place → verify MD5 == target; **or** swap the pre-built `index.html` (already MD5 `e00c632f…`, node-checked) shipped with this PLAN.
- No `.gs` change. Test T1–T9 on one real branch (esp. a late-close/cross-midnight run) before wide rollout.

## 7. Capture (durable)
```
ch-save "Issue3 shipped-plan: save() L4050+L4052 keyed off S.date (SPEC missed local half); new hasDayActivity() gates nudge+recompute because isEmptyState counts carried stock as non-empty; prefetch cb guarded by _closingPastDay; confirmCloseDay+queueCloudSync unchanged; target MD5 e00c632f" -Project puff-pos -Tags issue3,business-day,save,carry-over,concurrency
```
