# PLAN — Feature A: Recent-Branches Chip (index.html only)

Executor: **Antigravity** — surgical `str_replace` only.
**Scope this round: Feature A ONLY. Do NOT touch `franchise.gs` / Feature B — B is deferred (D-B2).**
All code below **pre-validated locally by NOVA** (`node --check` PASS, anchors unique 1-match).

## Baseline & target
| File | Pre-edit MD5 | Post-edit MD5 (target) | EOL |
|------|-------------|------------------------|-----|
| `index.html` | `94deea04423fe47c6e6ec13ce09877b3` | `72701e371a7a9a24ea50dda2ac10ba3e` | **LF** |

> If pre-edit MD5 ≠ `94deea04…`, the working file isn't the deployed `20260825.0002` build — stop and reconcile before editing.

## ⚠️ Correction vs the earlier draft plan
The earlier draft used `el("div", { class: ..., onclick: function(){} })`. **This is broken**: `el()` only special-cases `cls/txt/html/css`; every other key goes through `setAttribute`, which stringifies a function — so `onclick` would never fire (matches the known "never onclick:function" rule). Fix applied below: use `cls` (not `class`) and assign `.onclick` **after** the node is built, via an IIFE closure. `el()` is not modified.

Execution order: A1 → A2 → A3 → A4a → A4b → A4c → A4d → A5. Each: apply → stop-for-review → NOVA audit.

---

## A1 — CSS (additive, scoped)
Insert after the `.lf-note.show` rule.

**old_str:**
```
        .lf-note.show {
            display: block
        }
```
**new_str:**
```
        .lf-note.show {
            display: block
        }

        .lf-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 8px
        }

        .lf-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            background: var(--card-soft);
            border: 1px solid var(--border);
            border-radius: 20px;
            font-family: var(--ft);
            font-size: 12px;
            color: var(--ink);
            cursor: pointer;
            user-select: none
        }

        .lf-chip:hover {
            background: var(--card);
            border-color: var(--mustard)
        }

        .lf-chip-x {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            border: none;
            background: transparent;
            color: var(--muted);
            font-size: 11px;
            cursor: pointer;
            padding: 0;
            line-height: 1
        }

        .lf-chip-x:hover {
            background: rgba(210, 106, 92, .15);
            color: #D26A5C
        }
```
> Note: color var is `--ink` (verified). The earlier draft's `--text` does not exist in this file.

---

## A2 — HTML container
Insert `#loginRecentChips` right after the `loginFreeNote` div (inside the franchise `lf-group`).

**old_str:**
```
                <div class="lf-note" id="loginFreeNote">⚠️ รหัสนี้คือกุญแจเก็บข้อมูล —
                    พิมพ์ผิดแม้ตัวเดียวข้อมูลย้อนหลังหาย</div>
```
**new_str:**
```
                <div class="lf-note" id="loginFreeNote">⚠️ รหัสนี้คือกุญแจเก็บข้อมูล —
                    พิมพ์ผิดแม้ตัวเดียวข้อมูลย้อนหลังหาย</div>
                <div class="lf-chips" id="loginRecentChips"></div>
```

---

## A3 — Helper functions
Insert after `clearBranchAuth()`.

**old_str:**
```
        function clearBranchAuth() {
            localStorage.removeItem("puff10_branchAuth");
        }
```
**new_str:**
```
        function clearBranchAuth() {
            localStorage.removeItem("puff10_branchAuth");
        }
        function getRecentBranches() {
            try { return JSON.parse(localStorage.getItem("puff10_recentBranches") || "[]"); } catch (e) { return []; }
        }
        function pushRecentBranch(b) {
            if (!b) return;
            var isOwner = BRANCH_CODES.some(function (x) { return x.code === b; });
            if (isOwner) return;
            var list = getRecentBranches().filter(function (x) { return x !== b; });
            list.unshift(b);
            if (list.length > 5) list = list.slice(0, 5);
            localStorage.setItem("puff10_recentBranches", JSON.stringify(list));
            renderRecentChips();
        }
        function removeRecentBranch(b) {
            var list = getRecentBranches().filter(function (x) { return x !== b; });
            localStorage.setItem("puff10_recentBranches", JSON.stringify(list));
            renderRecentChips();
        }
        function renderRecentChips() {
            var box = $("loginRecentChips");
            if (!box) return;
            while (box.firstChild) box.removeChild(box.firstChild);
            var list = getRecentBranches();
            if (!list || !list.length) { box.style.display = "none"; return; }
            box.style.display = "flex";
            list.forEach(function (code) {
                var xBtn = el("button", { cls: "lf-chip-x", type: "button" }, "✕");
                xBtn.onclick = (function (c) {
                    return function (e) {
                        if (e && e.stopPropagation) e.stopPropagation();
                        removeRecentBranch(c);
                    };
                })(code);
                var chip = el("div", { cls: "lf-chip" }, [el("span", {}, code), xBtn]);
                chip.onclick = (function (c) {
                    return function () {
                        var fi = $("loginFreeInput");
                        if (fi) { fi.value = c; onLoginFreeInput(); }
                    };
                })(code);
                box.appendChild(chip);
            });
        }
```

---

## A4a — Hook: save on successful auth (`doLogin`)
**old_str:**
```
                    if (d && d.ok) { setBranchAuth(_loginBranch); finishLogin(); }
```
**new_str:**
```
                    if (d && d.ok) { setBranchAuth(_loginBranch); pushRecentBranch(_loginBranch); finishLogin(); }
```

---

## A4b — Hook: re-render while typing (`onLoginFreeInput`)
**old_str:**
```
            } else {
                _loginBranch = "";
                if (fn2) fn2.classList.remove("show");
            }
            updLoginBtn();
        }
        function updLoginBtn() {
```
**new_str:**
```
            } else {
                _loginBranch = "";
                if (fn2) fn2.classList.remove("show");
            }
            renderRecentChips();
            updLoginBtn();
        }
        function updLoginBtn() {
```

---

## A4c — Hook: re-render on logout (`doLogout`)
**old_str:**
```
        function doLogout() {
            stopHQPolling();
            pauseTimer();
            clearBranchAuth();
```
**new_str:**
```
        function doLogout() {
            stopHQPolling();
            pauseTimer();
            clearBranchAuth();
            renderRecentChips();
```

---

## A4d — Hook: render on login-screen init (`DOMContentLoaded`)
**old_str:**
```
            updLoginBtn();
            renderDeviceModeToggle();  // Task 1: show mode toggle on login screen
```
**new_str:**
```
            updLoginBtn();
            renderRecentChips();
            renderDeviceModeToggle();  // Task 1: show mode toggle on login screen
```

---

## A5 — Build stamp ×3 → `20260825.0003`
- `<meta name="build-version" content="20260825.0002">` → `content="20260825.0003"`
- `<title>Puff Stick POS v12 · 20260825.0002</title>` → `· 20260825.0003</title>`
- `                build 20260825.0002</div>` → `build 20260825.0003</div>`

---

## Audit (NOVA, after apply)
- MD5 == `72701e371a7a9a24ea50dda2ac10ba3e`
- inline JS `node --check` PASS · brace balance 0 · paren 0 · EOL LF
- `grep -c puff10_recentBranches` == 3 · `renderRecentChips()` calls == 6 · `pushRecentBranch` == 2 · `lf-chip` == 8
- stamp `20260825.0003` ×3 · `20260825.0002` == 0
- `grep -c "onclick: function"` in chip region == 0 (uses `.onclick =` assignment)

## Test (Tony, on device)
T-A1 franchise login → logout → chip shows · T-A2 tap chip → free input fills + button enables · T-A3 6 logins → only latest 5 · T-A4 owner `SBR-01` → no chip · T-A5 tap ✕ → gone, persists after reload · T-A6 re-login same code → moves to front, no dup.

## Deploy
Client-only. Push `index.html` to GitHub Pages when tests pass. No `.gs` redeploy. No PIN/rollout steps.
