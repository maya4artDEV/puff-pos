# PLAN — Viewer-Mode Silent-Write Fix (Issue-4 mini · index.html only)

Executor: **Antigravity** — exact surgical `str_replace`. **Client-only, no `.gs`.**
Pre-validated by NOVA (`node --check` PASS, all 4 anchors unique 1-match, MD5 target computed). No money/stock logic touched — pure UX feedback.

> SPEC + PLAN combined in one file on purpose: this is a 4-line behavior-preserving UX fix. Splitting into separate SPEC/PLAN would be ceremony.

## SPEC (why)
**Problem.** A device with `localStorage["puff7_device_mode"] = "viewer"` silently no-ops every write action — `saveFry`, `submitSell`, `saveDelivery`, `submitGiftSale` all `return;` with no toast. The device looks fully functional but nothing saves → root cause of the "ปุ่มทอดกดไม่ติด" field bug (RCA closed). `device_mode` is device-scoped and persists across logout/login, so once toggled to viewer it stays stuck.

**Decision (locked).** Turn the 4 silent user-action returns into a visible toast, so a stuck-viewer device explains itself. Justified on its own merits regardless of that one device — silent write-failure is a latent trap for every device.

**Scope guard.** ONLY the 4 user-action handlers. The 5th identical guard — `queueCloudSync` (L6166, `// Task 2: viewer never writes cloud state`) — is background sync and MUST stay silent (a toast there would fire on every internal sync tick). Left untouched.

## Baseline & target
| File | Pre-edit MD5 | Post-edit MD5 (target) | EOL |
|------|-------------|------------------------|-----|
| `index.html` | `d5efa714b30321e74b7d62f187fe0cba` (build 0004) | `cd04a25c4ffb45a41a588cae44b62a13` (build 0005) | **LF** |

> **Dependency:** baseline is the **post-Issue-1** file (build 0004). This PLAN stacks on Issue 1. If Issue 1 gets pushed or re-edited first, re-MD5 the file — it must still equal `d5efa714…` before running, else STOP.

Order: V1 → V2 → V3 → V4 → V5. Each anchor is `function line` + `guard line` so the identical guard string resolves to exactly one site per handler. Stop-for-review per task if desired; the change is trivial enough to run all five then audit.

---

### V1 — `saveDelivery` guard → toast
old:
```
        function saveDelivery() {
            if (getDeviceMode() === "viewer") return;
```
new:
```
        function saveDelivery() {
            if (getDeviceMode() === "viewer") { showToast("โหมดดูอย่างเดียว 👁 สลับเป็นโหมดบันทึกก่อน", true); return; }
```

### V2 — `submitSell` guard → toast
old:
```
        function submitSell() {
            if (getDeviceMode() === "viewer") return;
```
new:
```
        function submitSell() {
            if (getDeviceMode() === "viewer") { showToast("โหมดดูอย่างเดียว 👁 สลับเป็นโหมดบันทึกก่อน", true); return; }
```

### V3 — `saveFry` guard → toast
old:
```
        function saveFry() {
            if (getDeviceMode() === "viewer") return;
```
new:
```
        function saveFry() {
            if (getDeviceMode() === "viewer") { showToast("โหมดดูอย่างเดียว 👁 สลับเป็นโหมดบันทึกก่อน", true); return; }
```

### V4 — `submitGiftSale` guard → toast
old:
```
        function submitGiftSale() {
            if (getDeviceMode() === "viewer") return;
```
new:
```
        function submitGiftSale() {
            if (getDeviceMode() === "viewer") { showToast("โหมดดูอย่างเดียว 👁 สลับเป็นโหมดบันทึกก่อน", true); return; }
```

### V5 — build stamp ×3 → `20260825.0005`
- `content="20260825.0004"` → `content="20260825.0005"`
- `Puff Stick POS v12 · 20260825.0004` → `· 20260825.0005`
- `                build 20260825.0004</div>` → `build 20260825.0005</div>`

---

## Audit (NOVA — independent, never trust the report)
- MD5 == `cd04a25c4ffb45a41a588cae44b62a13` · inline JS `node --check` PASS · brace/paren 0 · EOL LF
- `grep -c "โหมดดูอย่างเดียว 👁 สลับเป็นโหมดบันทึกก่อน"` == **4**
- `queueCloudSync` guard still `return;  // Task 2: viewer never writes cloud state` (unchanged)
- stamp 0005 ×3 / 0004 == 0 · `.gs` untouched

## Test (on device)
- T1: normal writer device → fry / sell / gift / delivery all save as before (no toast, no regression).
- T2: set device to viewer (toggle "👁 ดูอย่างเดียว") → tap fry-save → toast "โหมดดูอย่างเดียว 👁 สลับเป็นโหมดบันทึกก่อน", nothing saved.
- T3: same viewer device → sell / gift / delivery → same toast each.
- T4: switch back to writer → all four save normally again.
- T5: background sync still silent in viewer (no spurious toast on sync tick).

## Deploy
Client-only. Push `index.html` to GitHub Pages after tests. No `.gs` redeploy. (Ships together with Issue 1's count-first change since both live in build 0005.)
