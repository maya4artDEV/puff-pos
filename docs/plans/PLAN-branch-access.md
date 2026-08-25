# PLAN — Per-Branch Login Access Control (branch-access)

Executor: **Antigravity** (surgical `str_replace` only, no regen).
Auditor: **NOVA** (hash-before-audit → `node --check` → brace balance → grep).
D1 locked: **register 5 owner branches only.** Franchise = open pass-through (no PINs).
All code below **pre-validated locally by NOVA** (`node --check` clean, anchors unique 1-match).

## Baselines & audit targets

| File | Pre-edit MD5 (must match before editing) | Post-edit MD5 (target after all its tasks) | EOL |
|------|------------------------------------------|--------------------------------------------|-----|
| `owner.gs` | `f95554e499a910b9f06233fe860b5a83` | `052187c23d4770b3a1c6d373c601f230` | **CRLF** |
| `franchise.gs` | `ee1c7e88a435eb912fdc908de0f53173` | `9d486696529d73e140eaaa0b7fc1fa04` | **CRLF** |
| `index.html` | `c7a63683e607fed00e7afc55411bcd44` | `6d8c2ce96a9ad15bfb85de3e1d5d6ef8` | **LF** |

> Pre-edit MD5 == baseline is expected. If, before an audit, the edited file's MD5 still equals
> the **pre-edit** baseline → file was not saved (Ctrl+S) → reject, do not audit.

Execution order: **S1 → S2 → C1 → C2 → C3 → C4 → C5 → P1 (manual) → rollout.**
Each task: apply → **stop-for-review** → NOVA audit → next.

---

## S1 — owner.gs · add `branch_auth` handler

**File:** `owner.gs` · **Constraint:** keep CRLF; do not touch `TG_BOT_TOKEN`.
Insert immediately after the `hq_auth` block, before `const ss = SpreadsheetApp.openById(SHEET_ID);`.

**old_str:**
```
      return ContentService.createTextOutput(JSON.stringify({ok:okHq})).setMimeType(ContentService.MimeType.JSON);
    }

    const ss   = SpreadsheetApp.openById(SHEET_ID);
```
**new_str:**
```
      return ContentService.createTextOutput(JSON.stringify({ok:okHq})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── Branch auth: PIN ต่อสาขา จาก Script Property BRANCH_PINS (JSON, ไม่อยู่ใน source) ──
    if (data.type === "branch_auth") {
      var bPins = {};
      try { bPins = JSON.parse(PropertiesService.getScriptProperties().getProperty("BRANCH_PINS") || "{}"); } catch (e2) { bPins = {}; }
      var brCode = String(data.branch || "");
      if (!Object.prototype.hasOwnProperty.call(bPins, brCode)) {
        return ContentService.createTextOutput(JSON.stringify({ok:true, open:true})).setMimeType(ContentService.MimeType.JSON);
      }
      var okBr = (String(data.pin) === String(bPins[brCode]));
      return ContentService.createTextOutput(JSON.stringify({ok:okBr})).setMimeType(ContentService.MimeType.JSON);
    }

    const ss   = SpreadsheetApp.openById(SHEET_ID);
```
**Audit:** copy `owner.gs`→`owner.js`, `node --check` clean · brace balance 0 · `grep -c branch_auth owner.gs` == 1 · `TG_BOT_TOKEN  = "";` still present · MD5 == `052187c2…`.

---

## S2 — franchise.gs · add `branch_auth` handler

**Identical** anchor + replacement as S1 (byte-identical `hq_auth` block confirmed in both files).
Required even with no franchise PINs — without it, `branch_auth` POSTs to FRANCHISE_URL fall through
and franchise login breaks. With empty `BRANCH_PINS`, every franchise code returns `{ok:true, open:true}`.

**Audit:** same as S1 · `grep -c branch_auth franchise.gs` == 1 · `gift_sale` untouched (still absent) · MD5 == `9d486696…`.

---

## C1 — index.html · add `loginPinInput` field

**File:** `index.html` (LF). Insert new group after the franchise `lf-group`.

**old_str:**
```
                <div class="lf-note" id="loginFreeNote">⚠️ รหัสนี้คือกุญแจเก็บข้อมูล —
                    พิมพ์ผิดแม้ตัวเดียวข้อมูลย้อนหลังหาย</div>
            </div>
```
**new_str:**
```
                <div class="lf-note" id="loginFreeNote">⚠️ รหัสนี้คือกุญแจเก็บข้อมูล —
                    พิมพ์ผิดแม้ตัวเดียวข้อมูลย้อนหลังหาย</div>
            </div>
            <div class="lf-group">
                <label class="lf-label" for="loginPinInput">รหัสผ่านสาขา <span style="opacity:.5">(เฉพาะสาขาที่ตั้งรหัส)</span></label>
                <input class="lf-input" id="loginPinInput" type="password" inputmode="numeric" placeholder="••••" autocomplete="off">
            </div>
```
PIN does **not** gate `loginBtn` (blank allowed for open franchise; server decides). No `oninput` handler.

**Audit:** `grep -c loginPinInput index.html` == 4 (label for + input id + 2 refs added in C3, so == 2 after C1 alone; final == 4 after C3).

---

## C2 — index.html · branch-session helpers

Insert **before** `function doLogin() {`.

**old_str:**
```
        function doLogin() {
```
**new_str:**
```
        function getBranchAuth() {
            try { return JSON.parse(localStorage.getItem("puff10_branchAuth") || "null"); } catch (e) { return null; }
        }
        function hasValidBranchSession(b) {
            var a = getBranchAuth();
            return !!(a && a.branch === b);
        }
        function setBranchAuth(b) {
            localStorage.setItem("puff10_branchAuth", JSON.stringify({ branch: b, ts: Date.now() }));
        }
        function clearBranchAuth() {
            localStorage.removeItem("puff10_branchAuth");
        }
        function doLogin() {
```
ES5 only. localStorage key `puff10_branchAuth`. No expiry (remember-until-logout).

---

## C3 — index.html · gate `doLogin()` through `branch_auth`

Wrap the existing login-completion into `finishLogin()`, then gate it: valid session → skip PIN;
else POST `branch_auth` to `getSyncURL(_loginBranch)` (mirrors the `hq_auth` fetch).

**old_str:**
```
            var btn = $("loginBtn"); if (btn) { btn.disabled = true; btn.textContent = "กำลังโหลด..."; }
            prefetchCloudState(_loginBranch, function () {
                if (btn) { btn.disabled = false; btn.textContent = "เริ่มใช้งาน"; }
                setBranch(_loginBranch);
                renderDeviceModeBadge();    // Task 1: show mode badge in header
                $("loginScreen").style.display = "none";
                $("mainApp").style.display = "block";
                requestAnimationFrame(function () {
                    go("home");
                    requestAnimationFrame(function () {
                        var cx = getNavCx(TABS.indexOf(currentTab));
                        _navToCx = _navFromCx = cx;
                        var p = $("navPath");
                        if (p) p.setAttribute("d", buildNavPath(cx));
                    });
                });
            });
        }
```
**new_str:**
```
            var btn = $("loginBtn"); if (btn) { btn.disabled = true; btn.textContent = "กำลังโหลด..."; }
            function finishLogin() {
                prefetchCloudState(_loginBranch, function () {
                    if (btn) { btn.disabled = false; btn.textContent = "เริ่มใช้งาน"; }
                    setBranch(_loginBranch);
                    renderDeviceModeBadge();    // Task 1: show mode badge in header
                    $("loginScreen").style.display = "none";
                    $("mainApp").style.display = "block";
                    requestAnimationFrame(function () {
                        go("home");
                        requestAnimationFrame(function () {
                            var cx = getNavCx(TABS.indexOf(currentTab));
                            _navToCx = _navFromCx = cx;
                            var p = $("navPath");
                            if (p) p.setAttribute("d", buildNavPath(cx));
                        });
                    });
                });
            }
            if (hasValidBranchSession(_loginBranch)) { finishLogin(); return; }
            var pin = ($("loginPinInput") || { value: "" }).value.trim();
            if (btn) btn.textContent = "กำลังตรวจสอบรหัส...";
            fetch(getSyncURL(_loginBranch), {
                method: "POST", mode: "cors",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ type: "branch_auth", branch: _loginBranch, pin: pin })
            })
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    if (d && d.ok) { setBranchAuth(_loginBranch); finishLogin(); }
                    else {
                        showToast("รหัสผ่านสาขาไม่ถูกต้อง", true);
                        var pI = $("loginPinInput"); if (pI) pI.value = "";
                        if (btn) { btn.disabled = false; btn.textContent = "เริ่มใช้งาน"; }
                    }
                })
                .catch(function () {
                    showToast("เชื่อมต่อไม่ได้ ลองใหม่", true);
                    if (btn) { btn.disabled = false; btn.textContent = "เริ่มใช้งาน"; }
                });
        }
```
**Audit:** inline JS `node --check` clean · brace balance 0 · `grep -c '"branch_auth"' index.html` == 1.

---

## C4 — index.html · clear session on logout

**old_str:**
```
        function doLogout() {
            stopHQPolling();
            pauseTimer();
```
**new_str:**
```
        function doLogout() {
            stopHQPolling();
            pauseTimer();
            clearBranchAuth();
```

---

## C5 — index.html · bump build stamp ×3 → `20260825.0001`

- **C5a** `<meta name="build-version" content="20260823.0216">` → `content="20260825.0001"`
- **C5b** `<title>Puff Stick POS v12 · 20260823.0216</title>` → `· 20260825.0001</title>`
- **C5c** `                build 20260823.0216</div>` → `build 20260825.0001</div>`

**Audit:** `grep -c 20260825.0001 index.html` == 3 · `grep -c 20260823.0216 index.html` == 0 · final MD5 == `6d8c2ce9…`.

---

## P1 — OWNER Script Property (manual, Tony)

Apps Script editor → **OWNER** project → Project Settings → Script Properties → add:

- **Key:** `BRANCH_PINS`
- **Value (fill real 4-digit PINs, per-branch, unique):**
```
{"SBR-01":"____","TBK-02":"____","MVK-03":"____","WNY-04":"____","BPI-05":"____"}
```
**FRANCHISE** project: do **not** set `BRANCH_PINS` (leave unset → all franchise open). Never commit PINs to repo/client.

---

## Rollout (deploy order is mandatory — PINs → .gs → client)

1. **P1** — set OWNER `BRANCH_PINS` (5 real PINs). Franchise: none.
2. **Deploy both `.gs`** as *New version* — branch-access **+ durian (DUR-001) together**, one round each script.
3. **Distribute** each owner branch its PIN + **notify in advance**. Confirm receipt before step 4.
4. **Push `index.html`** to GitHub Pages (`maya4artDEV/puff-pos` `main`).
5. **Verify on real device:** SBR-01 wrong PIN → blocked · SBR-01 correct PIN → in · one franchise code → open (no PIN) · durian ฿45 visible.
6. **Update staff guide v3** — add "รหัสผ่านสาขา" section.

> Never push client before PINs live + branches notified, or every active owner branch is locked out.

---

## Post-deploy verification (T1–T10 from SPEC §8)
T1 owner+correct→in · T2 owner+wrong→blocked · T3 owner+blank→blocked · T4 unregistered franchise→open ·
T5 (n/a at launch, no franchise PIN) · T6 valid session→PIN skipped · T7 switch branch→re-auth ·
T8 logout→`puff10_branchAuth` cleared · T9 offline→toast, no leak · T10 build stamp ×3 bumped.

## Out of scope (unchanged from SPEC)
Threat 2 endpoint hardening (Phase 2) · franchise self-service PIN · typo/collision fix (separate ticket) · franchise `gift_sale`.
