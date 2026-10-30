# PLAN-0017 · PWA (client-only, no .gs, no Service Worker)

Base: 0016 LIVE (`32cb01c`, MD5 `548a5633…`). Target stamp: `20261030.0017`.
Touches: `index.html` (surgical), + new `manifest.webmanifest`, `icons/*.png`, `tests/test-0017.js`.
Does NOT touch: localStorage keys, `el()`, `.gs`, sync/event types, any 0016 logic.

## 0. Flags (decided before building)
| # | Risk | Decision |
|---|---|---|
| R1 | iOS "Add to Home Screen" = **separate storage** from Safari (puff7_*, tokens, device mode all empty) | Not fixable in code. LINE notice: wait for ☁✓ in Safari → install → log in again (prefetchCloudState restores from cloud). HQ viewer device must re-set "ดูอย่างเดียว". |
| R2 | Android Chrome ≥108 "Install app" works **without** SW (confirmed, Chrome blog); auto install-prompt not shown | Staff install from ⋮ → Install app. Whether storage is shared with the Chrome tab: **not verified** → check in F1. |
| R3 | No SW = app cannot open offline (also true today in a tab; icon on home screen makes it more visible) | Keep decision (push→live MD5 stays honest). Revisit as separate build only if field reports. |
| R4 | `overscroll-behavior:none` kills pull-to-refresh; standalone has no reload button | In-app reload on build label (below). |
| R5 | 5 new static files → deploy must `git add icons/` + manifest | Block 2 probes each URL (status + content-type). |
| R6 | Spec said `scope /puff-pos/`; hard-coded path breaks on `file://` tests / repo rename | Use `start_url "./"`, `scope "./"`, `id "./"` (resolves to `/puff-pos/` on Pages). Same effect. |

## 1. manifest.webmanifest (repo root)
```json
{
  "id": "./",
  "name": "Puff Stick POS",
  "short_name": "Puff POS",
  "description": "Puff Stick daily POS",
  "lang": "th",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#EFEAE2",
  "theme_color": "#6FA3D6",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```
No `orientation` (tablets are used in both).

## 2. Icons (source = Tony's own puff PNG, never redraw)
Source: base64 PNG in `#puffSrcImg` (148×480, transparent). Canvas bg `#6FA3D6` full-bleed, puff rotated 35° (same as login), centered.
- `icon-192.png`, `icon-512.png` (any): rotated bbox ≤ 78 % of canvas
- `icon-maskable-512.png`: rotated bbox ≤ 56 % (inside 80 % safe circle)
- `apple-touch-icon.png` 180×180: opaque, same as "any" (iOS rounds corners itself)
Use whatever exists on the PC (PowerShell System.Drawing or Python PIL). Open each result with Read and look at it before committing.

## 3. index.html edits (surgical, 5 anchors)
**E1 · head** — after `<meta name="apple-mobile-web-app-status-bar-style" content="default">` add:
```html
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Puff POS">
<meta name="theme-color" content="#6FA3D6">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
```
**E2 · stamp** `20261029.0016` → `20261030.0017` in the 3 existing places (meta, title, `#buildVer`). No 4th hard-coded copy.
**E3 · CSS** — `.build-tap{cursor:pointer;text-decoration:underline dotted;padding:10px 8px;margin:-4px 0}` (≥40px touch height). Tablet block rule `#buildVer { order: 5; padding: 0 !important }` → drop the `padding` override (it would kill the tap area); keep `order`.
**E4 · login footer** — under `<div class="login-footer">ระบบจำข้อมูลในเครื่องนี้</div>` add `<div class="login-footer build-tap" id="loginBuild"></div>` (staff stuck on an old build at the login screen need reload too).
**E5 · JS** — new block right after `onSubTabClick()` (DOM already exists at that point), createElement/textContent only, no inline onclick, no template literals:
```js
// ── PWA (0017): in-app reload (standalone has no reload button) ──
function pwaBuildStamp() { var m = document.querySelector('meta[name="build-version"]'); return m ? m.getAttribute("content") : ""; }
function pwaDoReload() { location.reload(); }          // separate fn so tests can stub it
function pwaReload() {
    var pend = pwaPendingCount();                       // single source: see rule below
    var msg = "โหลดหน้าใหม่เพื่ออัปเดตเวอร์ชัน?\nรายการที่ยังไม่กดบันทึกจะหาย (ข้อมูลที่บันทึกแล้วอยู่ครบ)";
    if (pend > 0) msg += "\n\n⚠️ มี " + pend + " รายการรอส่งขึ้นคลาวด์ — จะส่งต่อให้หลังเข้าใหม่";
    if (!confirm(msg)) return;
    pwaDoReload();
}
function pwaWireBuildLabels() {
    var stamp = pwaBuildStamp();
    var lb = $("loginBuild"); if (lb) lb.textContent = "build " + stamp + " · แตะเพื่อโหลดใหม่";
    var bv = $("buildVer"); if (bv) { bv.classList.add("build-tap"); bv.textContent = "build " + stamp + " · แตะเพื่อโหลดใหม่"; }
    [lb, bv].forEach(function (n) { if (n) n.addEventListener("click", pwaReload); });
}
pwaWireBuildLabels();
```
**`pwaPendingCount()` rule:** Antigravity must grep `queueCloudSync`, `flushSyncQueue`, `updateSyncIcon`, `syncPending` and reuse the existing queue reader. If no single reader exists → STOP and report (do not invent a second queue parser); fallback = `pwaPendingCount` returns 0 and the confirm text stays generic.
Note: `#buildVer` text changes from `build X` → `build X · แตะเพื่อโหลดใหม่` (still contains the stamp → probe counts stay 3 *lines* for `Select-String`).

## 4. Tests — `tests/test-0017.js` (pure node, no npm)
| T | Check |
|---|---|
| T1 | manifest parses; fields = §1 exactly; icon files exist; PNG IHDR w×h = declared sizes |
| T2 | index.html has `<link rel="manifest">`, apple-touch-icon, theme-color == manifest.theme_color; every href resolves to an existing file |
| T3 | no `serviceWorker` / `navigator.serviceWorker` string in index.html |
| T4 | stamp `20261030.0017` on exactly 3 lines; old `20261029.0016` = 0 |
| T5 | headless Chrome (`%TEMP%` copy, `#` in path encoded, per 0016 learnings): stub `window.pwaDoReload` + `confirm`: confirm=false → 0 calls; true → 1 call; both labels exist and carry `build-tap` |
| T6 | no new `innerHTML`, template literal, `let/const`, arrow fn in the new block |
| T7 | `node --check` on extracted `<script>`; brace balance |
| T8 | regression: `test-0016a` 26/26 · `0016b` 17/17 · `0016c` 13/13 |

## 5. Antigravity prompt (paste as-is, one file edit in place)
> Repo: `D:\##PROJECT##\#1 92 KUMIMP\HTML\Anti IDE Project\puff-pos`. Task: build 0017 per `claude/PLAN-0017-pwa.md`. Rules: edit `index.html` in place with surgical edits at the 5 anchors only (diff must be < 60 lines); do not touch `el()`, localStorage keys, any 0016 logic; `var` + `function(){}` only; no innerHTML/template literals/inline onclick in new code. Create manifest + icons (view each icon image before continuing) + `tests/test-0017.js`. Resolve `pwaPendingCount()` per the PLAN rule (STOP and report if no single queue reader). Run `node --check` on the extracted script and all of T1–T8; report real output (counts per test, `git diff --stat`). Deny-list (`rm`, `git push`, `npm install`, `git reset`) needs my go-ahead — do not commit or push; I run Block 2.

## 6. Block 2 (Tony's PowerShell, after Antigravity reports all green)
See chat message — one paste: precheck → tests → commit → Enter-to-push → poll live stamp → MD5 → per-file probe → manifest parse → Date header.

## 7. Field checklist (next business day)
- P1 Android tablet (TBK-02): Chrome ⋮ → Install app → opens without URL bar; icon looks right; log in; sell 1 test order → ☁✓.
- P2 iPhone/iPad: Safari → Share → Add to Home Screen; open; log in again; data appears after prefetch; ☁✓.
- P3 In standalone, tap build label → confirm → page reloads → still logged in, today's data intact.
- P4 Push a trivial later build → P3 reload shows new stamp (proves update path without a browser).
- P5 Device-clock block (0016c) still triggers in standalone (HEAD `Date` works).
- P6 Android: is storage shared with the Chrome tab? Record answer (R2).
- Staff LINE notice: how to install (Android/iOS) + "wait for ☁✓ before installing / switching".
