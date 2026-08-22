# PLAN — HQ Access Control (Server PIN)

**For:** Antigravity (executor)
**Author:** NOVA (grounded against uploaded index.html build `20260821.0037` + Code_-_owner.gs + Code_-_franchise.gs)
**Goal:** Employees on writer devices cannot open HQ. HQ PIN is verified server-side against a Script Property (`HQ_PIN`), never stored on the client, never in source.

---

## HARD RULES (do not break)
- ES5 only: `var` / `function(){}`. No `let`/`const`/arrow/template-literal in **index.html**.
  (`.gs` files already use `const` — that's fine, keep their existing style.)
- DOM via `el()` helper. Never modify `el()`.
- Surgical `str_replace` only. **No full-file regen.** Each sub-task below = one targeted replace.
- `node --check` after **every** sub-task, before stop-for-review. `.gs` also passes `node --check` (syntax only).
- **STOP-FOR-REVIEW after each sub-task.** Do not merge sub-tasks. Do not add scope. Report before continuing.
- `.gs` files are **CRLF** — preserve line endings.

---

# PART A — CLIENT (`index.html`)

## A1 — Kill self-set PIN + make session-only auth
**Single source of truth:** HQ access = valid server-verified session. No client-side PIN store.

### A1.1 — Rewrite `checkHQAuth()` to depend on session only (remove `puff10_hqPin` gate)

**Find (exact):**
```
function checkHQAuth() {
    if (_hqAuthed) return true;
    var stored = localStorage.getItem("puff10_hqPin");
    var session = parseInt(localStorage.getItem("puff10_hqSession") || "0");
    if (!stored) return false;
    if (Date.now() - session < 8 * 3600 * 1000) { _hqAuthed = true; return true; }
    return false;
}
```
**Replace with:**
```
function checkHQAuth() {
    if (_hqAuthed) return true;
    var session = parseInt(localStorage.getItem("puff10_hqSession") || "0");
    if (session && (Date.now() - session < 8 * 3600 * 1000)) { _hqAuthed = true; return true; }
    return false;
}
```
> Why: after A3 the client never writes `puff10_hqPin`, so the old `if (!stored) return false` would make the 8-hr session never validate. Now session alone gates.

### A1.2 — Rewrite `renderHQTab()` to remove the setup branch

**Find (exact):**
```
function renderHQTab() {
    var pg = $("page-hq"); if (!pg) return;
    clr(pg);
    if (checkHQAuth()) { renderHQDashboard(pg); }
    else {
        var stored = localStorage.getItem("puff10_hqPin");
        if (!stored) { renderHQSetupPin(pg); }
        else         { renderHQEnterPin(pg); }
    }
}
```
**Replace with:**
```
function renderHQTab() {
    var pg = $("page-hq"); if (!pg) return;
    clr(pg);
    if (checkHQAuth()) { renderHQDashboard(pg); }
    else { renderHQEnterPin(pg); }
}
```

### A1.3 — Delete `renderHQSetupPin()` entirely

**Find and delete the whole function** (starts `function renderHQSetupPin(pg) {`, ends at its closing `}` before `function renderHQEnterPin(pg) {`). Full block to remove:
```
function renderHQSetupPin(pg) {
    var wrap = el("div", {css:"max-width:400px;margin:0 auto;padding:24px 16px"});
    wrap.appendChild(el("div", {txt:"ตั้ง PIN ครั้งแรก", css:"font-family:var(--fb);font-size:20px;color:var(--cocoa);margin-bottom:6px"}));
    wrap.appendChild(el("div", {txt:"PIN นี้ใช้เข้าหน้า HQ Dashboard — ตั้งได้ 4-6 หลัก", css:"font-size:12px;color:var(--muted);margin-bottom:24px"}));
    var inp1 = el("input", {type:"tel", maxlength:"6", placeholder:"PIN ใหม่ (4-6 หลัก)", css:"width:100%;padding:14px;font-size:20px;letter-spacing:6px;text-align:center;border:1.5px solid var(--cream2);border-radius:12px;background:#fff;margin-bottom:12px;box-sizing:border-box"});
    var inp2 = el("input", {type:"tel", maxlength:"6", placeholder:"ยืนยัน PIN อีกครั้ง", css:"width:100%;padding:14px;font-size:20px;letter-spacing:6px;text-align:center;border:1.5px solid var(--cream2);border-radius:12px;background:#fff;margin-bottom:20px;box-sizing:border-box"});
    var btn = el("button", {txt:"ตั้ง PIN", css:"width:100%;padding:16px;background:var(--cocoa);color:#fff;border:none;border-radius:12px;font-family:var(--fb);font-size:16px;cursor:pointer"});
    btn.onclick = function() {
        var p1 = inp1.value.trim(); var p2 = inp2.value.trim();
        if (p1.length < 4) { showToast("PIN ต้องมีอย่างน้อย 4 หลัก", true); return; }
        if (p1 !== p2)     { showToast("PIN ไม่ตรงกัน", true); return; }
        localStorage.setItem("puff10_hqPin", btoa(p1));
        localStorage.setItem("puff10_hqSession", String(Date.now()));
        _hqAuthed = true;
        showToast("ตั้ง PIN สำเร็จ");
        renderHQTab();
    };
    wrap.appendChild(inp1); wrap.appendChild(inp2); wrap.appendChild(btn);
    pg.appendChild(wrap);
}

```
(Remove the trailing blank line too so there aren't two blanks before `renderHQEnterPin`.)

**➡ node --check → STOP-FOR-REVIEW (A1)**
Report: confirm `grep -c renderHQSetupPin index.html` == `0`, `grep -c puff10_hqPin index.html` == `0`.

---

## A2 — Hide HQ tab on writer + guard `go()`

### A2.1 — Add visibility helper (place directly ABOVE `function getDeviceMode() {`)

**Find (exact):**
```
function getDeviceMode() {
    return localStorage.getItem("puff7_device_mode") || "writer";
}
```
**Replace with:**
```
function applyHQTabVisibility() {
    var btn = $("tab-hq");
    if (!btn) return;
    btn.style.display = (getDeviceMode() === "viewer") ? "" : "none";
}
function getDeviceMode() {
    return localStorage.getItem("puff7_device_mode") || "writer";
}
```

### A2.2 — Call it inside `setDeviceMode()` so toggling updates live

**Find (exact):**
```
function setDeviceMode(m) {
    localStorage.setItem("puff7_device_mode", m);
    renderDeviceModeBadge();
    renderDeviceModeToggle();
}
```
**Replace with:**
```
function setDeviceMode(m) {
    localStorage.setItem("puff7_device_mode", m);
    renderDeviceModeBadge();
    renderDeviceModeToggle();
    applyHQTabVisibility();
}
```

### A2.3 — Call it once on init (inside DOMContentLoaded, after the existing `renderDeviceModeToggle();` "Task 1" line)

**Find (exact):**
```
    renderDeviceModeToggle();  // Task 1: show mode toggle on login screen
    var dmt = $("deviceModeToggle");
```
**Replace with:**
```
    renderDeviceModeToggle();  // Task 1: show mode toggle on login screen
    applyHQTabVisibility();    // hide HQ tab for writer devices
    var dmt = $("deviceModeToggle");
```

### A2.4 — Guard `go("hq")` so a writer can't reach it via URL/keyboard

**Find (exact):**
```
function go(tab) {
    if (currentTab === "hq" && tab !== "hq") { stopHQPolling(); }
    if (!currentBranch && tab !== "home") { showToast("กรุณา login ก่อนใช้งาน", true); return; }
```
**Replace with:**
```
function go(tab) {
    if (currentTab === "hq" && tab !== "hq") { stopHQPolling(); }
    if (tab === "hq" && getDeviceMode() !== "viewer") { showToast("หน้านี้สำหรับ HQ เท่านั้น", true); return; }
    if (!currentBranch && tab !== "home") { showToast("กรุณา login ก่อนใช้งาน", true); return; }
```

**➡ node --check → STOP-FOR-REVIEW (A2)**
Report: `grep -n applyHQTabVisibility index.html` shows 1 def + 2 call sites (setDeviceMode, DOMContentLoaded). Nav pill note: `#tab-hq` uses `display:none` for writers — the other 6 buttons keep `flex:1`, and writers never navigate to index 6, so `getNavCx` math for tabs 0–5 is unaffected. No change to `moveNav`/`getNavCx`.

---

## A3 — Convert `renderHQEnterPin` to server POST

Only the `btn.onclick` handler changes. Keep the rest of the function (wrap/inp/btn/keyup) as-is.

**Find (exact):**
```
    btn.onclick = function() {
        var stored = localStorage.getItem("puff10_hqPin") || "";
        var entered = btoa(inp.value.trim());
        if (entered === stored) {
            localStorage.setItem("puff10_hqSession", String(Date.now()));
            _hqAuthed = true;
            renderHQTab();
        } else {
            showToast("PIN ไม่ถูกต้อง", true);
            inp.value = "";
        }
    };
```
**Replace with:**
```
    btn.onclick = function() {
        var pin = inp.value.trim();
        if (pin.length < 4) { showToast("ใส่ PIN ก่อน", true); return; }
        btn.disabled = true; btn.textContent = "กำลังตรวจสอบ...";
        fetch(OWNER_URL, {
            method:"POST", mode:"cors",
            headers:{"Content-Type":"text/plain;charset=utf-8"},
            body:JSON.stringify({type:"hq_auth", pin:pin})
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (d && d.ok) {
                localStorage.setItem("puff10_hqSession", String(Date.now()));
                _hqAuthed = true;
                renderHQTab();
            } else {
                showToast("PIN ไม่ถูกต้อง", true);
                inp.value = "";
                btn.disabled = false; btn.textContent = "เข้าสู่ระบบ HQ";
            }
        })
        .catch(function() {
            showToast("เชื่อมต่อไม่ได้ ลองใหม่", true);
            btn.disabled = false; btn.textContent = "เข้าสู่ระบบ HQ";
        });
    };
```
> Routing: HQ is Owner-scoped (dashboard reads `OWNER_URL?type=state_list`), so auth POSTs to `OWNER_URL` directly. `text/plain;charset=utf-8` = CORS-safelisted → no preflight → response `.json()` is readable (same pattern as `flushSyncQueue`).

**➡ node --check → STOP-FOR-REVIEW (A3)**
Report: `grep -c btoa index.html` == `0` (all btoa PIN logic gone). Confirm the Enter-key listener line `inp.addEventListener("keyup", ...)` still present.

---

## A4 — Bump build stamp (3 spots, identical value)

Set all three to the **actual build moment** `YYYYMMDD.HHMM` (Asia/Bangkok). Current value in all three = `20260821.0037` — bump it.

1. Meta (line ~11): `<meta name="build-version" content="20260821.0037">`
2. Title (line ~12): `<title>Puff Stick POS v12 · 20260821.0037</title>`
3. `#buildVer` div (line ~623): `>build 20260821.0037<`

Do 3 separate `str_replace`, one per spot. All three must end identical.

**➡ node --check → STOP-FOR-REVIEW (A4)**
Report: `grep -c '20260821.0037' index.html` == `0`; new stamp appears exactly 3×.

---

# PART B — SERVER (`Code_-_owner.gs` + `Code_-_franchise.gs`)

Same edit in both files. CRLF — preserve.

## B1 — Owner: add `hq_auth` handler (short-circuits before opening the sheet)

**Find (exact — appears once):**
```
    const data = JSON.parse(e.postData.contents);
    const ss   = SpreadsheetApp.openById(SHEET_ID);
```
**Replace with:**
```
    const data = JSON.parse(e.postData.contents);

    // ── HQ auth: เทียบ PIN กับ Script Property HQ_PIN (ไม่อยู่ใน source) ──
    if (data.type === "hq_auth") {
      var hqPin = PropertiesService.getScriptProperties().getProperty("HQ_PIN") || "";
      var okHq  = (hqPin !== "" && String(data.pin) === String(hqPin));
      return ContentService.createTextOutput(JSON.stringify({ok:okHq})).setMimeType(ContentService.MimeType.JSON);
    }

    const ss   = SpreadsheetApp.openById(SHEET_ID);
```

## B2 — Franchise: same edit (parity / future-proof)

Apply the **identical** `str_replace` from B1 to `Code_-_franchise.gs` (same two anchor lines exist there).

**➡ node --check (both .gs) → STOP-FOR-REVIEW (B)**
Report: `grep -c hq_auth Code_-_owner.gs` == `1`, `grep -c hq_auth Code_-_franchise.gs` == `1`. Confirm no real PIN string anywhere in either file.

---

# PART C — MANUAL (Tony, not Antigravity)

Do **after** B is committed. Order matters:

1. **Owner Apps Script** → ⚙ Project Settings → Script Properties → Add property
   - key: `HQ_PIN`  value: `<your PIN>`
2. **Owner** → Deploy → Manage deployments → (existing) → Edit → Version: **New version** → Deploy. *(Required — client hq_auth hits OWNER_URL.)*
3. **Franchise Apps Script** → add same `HQ_PIN` property → New-version redeploy. *(Optional now — only needed if HQ ever becomes franchise-scoped. Set it for parity.)*
4. Confirm `.gs` in repo still have `TG_BOT_TOKEN = ""` before commit (never commit the real token).

**Field test (writer device):** HQ tab hidden; typing the HQ URL/route shows "หน้านี้สำหรับ HQ เท่านั้น".
**Field test (viewer device):** HQ tab visible → wrong PIN = "PIN ไม่ถูกต้อง"; correct PIN = dashboard loads; reopen within 8 hr = no re-prompt (session).

---

# WHY (RCA of the original hole)
`renderHQSetupPin` let **any** device set `puff10_hqPin` locally, and `renderHQEnterPin` compared `btoa(input)` against that local value → zero real identity; any employee could self-set a PIN and read every branch's totals. Moving the check to a server Script Property removes the secret from the client entirely and ties HQ access to something only Tony controls.

# OUT OF SCOPE (do NOT touch)
- `refreshHQData`, `renderHQDashboard`, HQ polling.
- `el()` helper, localStorage key formats, Apps Script event types (`sale`/`fry`/`gift_sale`/`delivery_sale`/`state_save`).
- The existing inline `onclick:"go('hq')"` on the dashboard refresh button (pre-existing pattern; not part of this task).
