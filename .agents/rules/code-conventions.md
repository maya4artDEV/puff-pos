# Rule: POS code conventions (`index.html`)

Applies to `index.html` (the POS app). Full reference: `docs/puffstick-conventions.md`.

## JavaScript — DO
- `var` only. Never `let` / `const`.
- `function(){}` only. Never arrow functions.
- Build **all** DOM through the `el(tag, attrs, kids)` helper. Never touch the helper itself.
- IIFE for closures in loops: `(function(id){ ... })(id)`.
- Concatenate strings with `+`. Never rely on adjacent string literals (`'a' 'b'`).
- localStorage prefix `puff7_`.
- Filling IDs = 3-char UPPERCASE: `ORI`, `SEA`, `BNN`.
- Branch codes = `XXX-NN` (e.g. `SBR-01`). Event branches start with `E`.

## JavaScript — DON'T (these caused real bugs)
- No `innerHTML` concatenation with nested quotes → use `el()`.
- No template literals (`` ` ``) in DOM rendering.
- No Python-style escaping (`\'`).
- No `var location` (shadows `window.location`) → use `locName`.
- No `oninput` that triggers a full re-render (cursor jumps) → update only the sum element.
- **No `onclick: function(){}` passed to `el()`.** `el()` has no `onclick` case, so a function value hits `setAttribute("onclick", fn)` → stringified, closure lost → the handler throws on click (dead button, no visible error). Use a `data-*` attribute + one delegated `addEventListener` on the container. Any interactive element built via `el()` must be **clicked in a browser** before its task is called done — `node --check`/brace-balance do not test behavior.
- ห้ามส่ง `onclick: function(){}` เข้า `el()` — `el()` ไม่มี case onclick, function value จะไป `setAttribute("onclick", fn)` → stringify, closure หาย → handler throw ตอนคลิก (ปุ่มตาย ไม่มี error). ใช้ `data-*` attribute + delegated `addEventListener` บน container แทน. element ที่ทำผ่าน `el()` ต้องคลิกเทสจริงในเบราว์เซอร์ก่อนถือว่า task ผ่าน — `node --check`/brace-balance ไม่ได้เทส behavior

## Known bug patterns — prevent, don't re-introduce
| Symptom | Cause | Prevention |
|---|---|---|
| `SyntaxError` in JS | Python-style escaping | raw strings, no `\'` |
| functions undefined | adjacent string literals | always `+` |
| style parser broken | single quote inside `style="font-family:'X'"` | use a CSS class |
| cursor jumps in input | `oninput` re-renders list | update sum node only |
| `location` shadowing | `var location` | use `locName` |

## Before presenting any JS change
1. Extract the `<script>` block, run `node --check` — must be 0 errors.
2. Brace balance verified.
3. No bare `return` outside a function.
4. `str_replace` one spot at a time — never regenerate the file.
5. Diff over ~100 lines → stop, the approach is wrong.
6. Bump the build stamp inside `index.html` when you ship a change.

## Agent workflow discipline (graduated from Task 5-7 captures)

### Rule A — respect sub-task boundaries
เมื่อ PLAN เขียนว่า "stop for review before next sub-task" — หยุดจริง ห้ามรวมหลาย sub-task ใน 1 commit เพื่อประหยัดรอบ. Bisect หลัง regression ต้อง bisect ได้ทีละ sub-task. เกิดขึ้นซ้ำใน Task 5 (Owner+Franchise รวด), Task 6½ (A+B รวด), Task 7 (A+B รวด). ถ้าเจอ PLAN บอกหยุด แล้วรู้สึกว่า sub-task ต่อไปเล็กมาก — ให้หยุดถาม user ก่อนรวม อย่าตัดสินใจเอง.

### Rule B — report scope-additions before making them
เมื่อ audit code เจอ related issue นอก PLAN (เช่น pre-existing fetch อีกจุด, wire point ที่ควรเพิ่ม) — **หยุดรายงาน user ก่อนแก้** อย่าเงียบๆ ทำเอง. ตัวอย่างจริง:
- Task 6½A agent เพิ่ม delivery fetch (@1719) เข้ามาเอง — ถูก แต่ควรถาม
- Task 7B agent wire `stopHQPolling` ใน `doLogout` — ถูก แต่ควรถาม

การเงียบทำเองแม้ถูก = user เสียโอกาส review scope + decision ownership. Report format: "PLAN บอก X. audit เจอ Y ด้วย ที่ควรทำพร้อมกัน. เพิ่มไหม?"

### Rule C — verified test ≠ regression test
ห้ามอ้าง "Playwright test 100% pass" เป็นหลักฐานว่า feature ใหม่ทำงาน ถ้าใช้ test เดิมที่ไม่ได้เขียนให้ feature ใหม่. Test เดิม (test-task1-task2.js) เทสแค่ Task 1+2 = ไม่ครอบคลุม CORS / HQ polling / recovery. เกิดขึ้นใน Task 6½.
- ถ้าเทส feature ใหม่ = ต้องเขียน test ใหม่ที่เรียก function/UI ของ feature นั้นจริง (ไม่ใช่จำลอง logic ใน test body — บทเรียนจาก Task 3)
- ถ้าไม่ได้เขียน test ใหม่ = พูดตรงๆ "regression test เดิมยังผ่าน, feature ใหม่ยังไม่ได้เทส automated — ต้องเทสมือ"

