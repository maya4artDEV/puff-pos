# PLAN — Issue 1: Count-First Close-Day (index.html only)

Executor: **Antigravity** — exact surgical `str_replace`. **Client-only, no `.gs`.**
Pre-validated by NOVA (`node --check` PASS, all anchors unique 1-match). Money-math change → audit carefully.
Decisions locked: 1-D4 (auto count-first + block confirm until counted), 1-D5 (show tapped as reference), 1-D6 (counted resets daily via `newState`).

## Baseline & target
| File | Pre-edit MD5 | Post-edit MD5 (target) | EOL |
|------|-------------|------------------------|-----|
| `index.html` | `72701e371a7a9a24ea50dda2ac10ba3e` (build 0003) | `d5efa714b30321e74b7d62f187fe0cba` (build 0004) | **LF** |

## What changes & why
`calcClose` used tapped `S.sales` as `expected` → branches that don't tap showed false "เกิน" daily. Now front-desk revenue is derived from the physical count (`fry_out − counted − damaged − free − deliveryPieces`), delivery money stays separate as net (no double), tapped becomes a reference only. Physical counts are now persisted in `S.counted` (they were DOM-only). `save()` serializes whole `S` → `counted` syncs automatically; `newState` inits `counted:{}` → resets each day.

Order: I1 → I2a → I2b → I3a → I3b → I3c → I3d → I4 → I5. Stop-for-review per task.

---

### I1 — state: add `counted`
old: `                damaged: {}, free_items: {}, pricePerPiece: 25,`
new: `                damaged: {}, free_items: {}, counted: {}, pricePerPiece: 25,`

### I2a — `onPhysCount`: persist count to state
old:
```
        function onPhysCount(id) {
            if (!S) return;
            var inp = $("pc-" + id); if (!inp) return;
```
new:
```
        function onPhysCount(id) {
            if (!S) return;
            if (!S.counted) S.counted = {};
            var inp = $("pc-" + id); if (!inp) return;
            if (inp.value === "") { delete S.counted[id]; } else { S.counted[id] = parseInt(inp.value) || 0; }
            save();
```

### I2b — phys-count input: restore value from state
old: `var inp = el("input", { cls: "phys-cell-input", id: "pc-" + f.id, type: "number", min: "0", placeholder: "นับได้" });`
new: `var inp = el("input", { cls: "phys-cell-input", id: "pc-" + f.id, type: "number", min: "0", placeholder: "นับได้", value: (S.counted && S.counted[f.id] !== undefined && S.counted[f.id] !== null ? String(S.counted[f.id]) : "") });`

### I3a — add `isCountComplete()` + guard in `calcClose`
old:
```
        function calcClose() {
            if (!S) return;
```
new:
```
        function isCountComplete() {
            if (!S || !S.counted) return false;
            var ok = true;
            F.forEach(function (f) {
                var fo = (S.stock[f.id] && S.stock[f.id].fry_out) || 0;
                if (fo <= 0) return;
                var cv = S.counted[f.id];
                if (cv === undefined || cv === null || cv === "") ok = false;
            });
            return ok;
        }
        function calcClose() {
            if (!S) return;
            if (!S.counted) S.counted = {};
```
(“complete” = every filling with `fry_out > 0` has a count.)

### I3b — count-first front-desk revenue (replaces tapped `puffAmt`)
old: `            var puffAmt = S.sales.reduce(function (a, s) { return a + s.totalAmount; }, 0);`
new:
```
            var dlvPieces = {};
            (S.delivery_sales || []).forEach(function (d) { (d.items || []).forEach(function (it) { dlvPieces[it.id] = (dlvPieces[it.id] || 0) + (it.pieces || 0); }); });
            var puffAmt = 0;
            F.forEach(function (f) {
                var fo = (S.stock[f.id] && S.stock[f.id].fry_out) || 0;
                if (fo <= 0) return;
                var cv = S.counted[f.id];
                if (cv === undefined || cv === null || cv === "") return;
                var sold = fo - (parseInt(cv) || 0) - (S.damaged[f.id] || 0) - (S.free_items[f.id] || 0) - (dlvPieces[f.id] || 0);
                if (sold < 0) sold = 0;
                puffAmt += sold * getPrice(f.id);
            });
            var tappedAmt = S.sales.reduce(function (a, s) { return a + s.totalAmount; }, 0);
            var countsComplete = isCountComplete();
```

### I3c — pending state until counted (1-D4)
old:
```
            var cr = $("closeResult"); if (!cr) return;
            if (!ca && !tr && !dlv) { clr(cr); return; }
            var diff = net - expected;
```
new:
```
            var cr = $("closeResult"); if (!cr) return;
            if (!ca && !tr && !dlv) { clr(cr); return; }
            if (!countsComplete) { clr(cr); var pend = el("div", { cls: "diff-card diff-over" }); pend.appendChild(el("div", { cls: "diff-icon", txt: "📝" })); var pinfo = el("div", { cls: "diff-info" }); pinfo.appendChild(el("div", { cls: "diff-title", txt: "นับเหลือหน้าตู้ให้ครบก่อน" })); pinfo.appendChild(el("div", { cls: "diff-sub", txt: "ระบบคิดยอดขายจากยอดนับเหลือ — ใส่จำนวนที่เหลือทุกไส้ที่ทอด" })); pend.appendChild(pinfo); cr.appendChild(pend); return; }
            var diff = net - expected;
```

### I3d — tapped reference line (1-D5)
old:
```
            info.appendChild(el("div", { cls: "diff-sub", txt: sub }));
            card.appendChild(info); cr.appendChild(card);
```
new:
```
            info.appendChild(el("div", { cls: "diff-sub", txt: sub }));
            card.appendChild(info); cr.appendChild(card);
            cr.appendChild(el("div", { css: "text-align:center;font-size:11px;color:var(--muted);margin-top:6px", txt: "กดขายระหว่างวัน (อ้างอิง): ฿" + tappedAmt.toLocaleString() }));
```

### I4 — block confirm until counted (1-D4)
old:
```
                showToast("กรุณาใส่ยอดเงินก่อนปิดวัน", true);
                return;
            }
            if (!confirm(
```
new:
```
                showToast("กรุณาใส่ยอดเงินก่อนปิดวัน", true);
                return;
            }
            if (!isCountComplete()) {
                showToast("นับเหลือหน้าตู้ให้ครบทุกไส้ก่อนปิดวัน", true);
                return;
            }
            if (!confirm(
```

### I5 — build stamp ×3 → `20260825.0004`
- `content="20260825.0003"` → `content="20260825.0004"`
- `<title>Puff Stick POS v12 · 20260825.0003</title>` → `· 20260825.0004</title>`
- `                build 20260825.0003</div>` → `build 20260825.0004</div>`

---

## Audit (NOVA)
- MD5 == `d5efa714b30321e74b7d62f187fe0cba` · inline JS `node --check` PASS · brace/paren 0 · EOL LF
- `grep -c "S.counted"` == 13 · `isCountComplete` == 3 · `dlvPieces` present · stamp 0004 ×3 / 0003 == 0
- `.gs` files untouched

## Test (on device)
- T1: fry, tap nothing, count leftovers → expected = count-derived, diff correct (no false "เกิน").
- T2: cash entered but not all fried fillings counted → shows "นับเหลือหน้าตู้ให้ครบก่อน", no diff.
- T3: tap some sales + count leftovers → expected still correct (no double); "กดขายระหว่างวัน (อ้างอิง)" line shows the tapped figure.
- T4: delivery order + count → delivery pieces not double-counted (subtracted from front-desk, added as net).
- T5: try "ยืนยันปิดวัน" before counting all fried fillings → blocked with toast.
- T6: enter counts → refresh app → counts persist (reads `S.counted`).
- T7: new day → counts reset to empty.

## Deploy
Client-only. Push `index.html` to GitHub Pages after tests. No `.gs` redeploy.
