# HANDOFF BRIEF — เปิดแชทใหม่ทำต่อ (Special Filling feature)

## First message ที่แนะนำให้พิมพ์ในแชทใหม่
> "อ่าน HANDOFF-special-filling.md (แนบ) — HQ access control ปิดจบแล้ว. เริ่มงาน 'ไส้พิเศษ' (temporary filling ราคาแยก + พนักงานเพิ่มเองได้ + ผูกระบบทอดครบ). เขียน SPEC + PLAN ก่อน อย่าเพิ่ง code — feature นี้กระทบ schema + production 20 สาขา. ground index.html ที่จะแนบก่อน"

---

## สถานะ ณ ตอนปิดแชทเก่า

### ✅ HQ Access Control (Server PIN) — เสร็จครบ audited
POS live: `https://maya4artdev.github.io/puff-pos/` · repo `maya4artDEV/puff-pos` branch main
Local: `D:\##PROJECT##\#1 92 KUMIMP\HTML\Anti IDE Project\puff-pos`
Build ล่าสุด client = `20260822.2052`

- **A1** `checkHQAuth` → session-only (ตัด `puff10_hqPin` gate), `renderHQSetupPin` ลบทิ้ง — audited + committed
- **A2** ซ่อน `#tab-hq` เมื่อ writer (`applyHQTabVisibility()` เรียกใน setDeviceMode + DOMContentLoaded), `go("hq")` guard non-viewer — audited + committed
- **A3** `renderHQEnterPin` btn.onclick → POST `{type:"hq_auth", pin}` ไป OWNER_URL (ตัด btoa/puff10_hqPin, มี disabled state + catch) — audited (diff 34 บรรทัดสะอาด) + committed
- **A4** build stamp bump 3 จุด `20260822.2052` — audited
- **B1/B2** `.gs` owner + franchise เพิ่ม `hq_auth` handler (เทียบ `PropertiesService.getScriptProperties().getProperty("HQ_PIN")`, short-circuit ก่อน openById) — audited, TG_BOT_TOKEN="" ยืนยันไม่หลุด, CRLF รักษาไว้ + committed

### ✅ Git — commit + push ครบแล้ว (working tree clean, up to date origin/main)
- `f93265c` feat: HQ access control A3 server-PIN + A4 build stamp 20260822.2052
- `86d2dc3` feat: hq_auth handler (server PIN via HQ_PIN ScriptProperty) — owner + franchise
- `cc79ee3` refactor: HQ access control A1-A2 (client) + prettier reformat
- `02bd78b` fix: hide number spinner, auto-select on focus [build 20260821.0037]

### ✅ Part C — manual (Tony) — เสร็จแล้ว
1. ✅ Owner Script Properties → `HQ_PIN` ตั้งแล้ว
2. ✅ Owner redeploy New version แล้ว (hq_auth live บน OWNER_URL)
3. Franchise (optional) — [Tony: ทำหรือยัง ไม่จำเป็น]
4. ✅ Field test ผ่าน

**สรุป: HQ Access Control ปิดจบสมบูรณ์ 100% — client + server + deploy ครบ**

---

## 🎯 งานถัดไป: Special Filling (ไส้พิเศษชั่วคราว)

### ปัญหาจริง (จาก Tony)
มีไส้ใหม่ = **ทุเรียน** ราคาขายต่อชิ้น **ไม่เท่าไส้ปกติ** และ **ยังไม่ทำขายถาวร** (ชั่วคราว)
ตอนนี้ Tony workaround ด้วยการเอาทุเรียนไปใส่ feature "ของฝาก" (เพราะของฝากมีราคาแยก + รับเข้า/ตัดสต็อกได้)
**แต่ของฝากไม่ผูกระบบทอด** → ตัดสต็อกตามยอดขายเฉย ๆ **ไม่ตัดตามยอดสั่งทอด** = flow เพี้ยน (ทุเรียนต้องทอดก่อนขาย)

### สิ่งที่ Tony อยากได้จริง (ยืนยันจาก elicitation แล้ว)
ไส้พิเศษที่ทำงาน **เหมือนไส้ปกติทุกอย่าง** (รับสต็อกแช่แข็ง → ทอด → ขาย ครบ flow) **แต่ต่าง 2 จุด:**
1. **ราคาต่อชิ้นแยกเอง** — ไม่ใช้ `pricePerPiece` กลางร้าน
2. **พนักงานหน้าร้านเพิ่ม/ลบเองได้** (เหมือนกดเพิ่มของฝาก) — ชั่วคราว ไม่ฝัง code ถาวร

### 🔴 ทำไมต้อง SPEC + PLAN ก่อน (อย่า surgical รีบ)
กระทบหลายจุด + production sensitive:
- **storage schema** — เพิ่ม custom fillings + per-filling price เข้า state → กระทบ **carry-over ข้ามวัน** (ยกไส้พิเศษ+ราคา+สต็อกเหลือไปวันใหม่)
- **6+ จุด render** — sell card, fry page, fry chart, stock page, close/นับเหลือ, hist
- **การคำนวณยอด** — ทุกที่ที่คูณ `pricePerPiece` ต้องเช็คว่าไส้นี้ราคากลางหรือราคาเฉพาะ → **single source of truth เรื่องราคา** สำคัญมาก
- **Apps Script** — event `sale`/`fry` ต้องรับ filling id ที่ไม่อยู่ใน master `F` list; sheet column อาจต้องรองรับ

### จุดที่ต้อง scope เพิ่มในแชทใหม่ (ยังไม่ถาม)
- ไส้พิเศษ id format? (ปกติ 3 ตัวพิมพ์ใหญ่ เช่น DUR สำหรับทุเรียน — แต่ custom = พนักงานพิมพ์เอง ต้องกัน id ชนกับ F master)
- เก็บใน state key ไหน? (`special_fillings` array แยก หรือ merge เข้า stock?)
- ลบไส้พิเศษแล้วสต็อก/ยอดขายที่บันทึกไปแล้วทำยังไง?
- sync ขึ้น sheet ไหม หรือ local อย่างเดียวช่วงชั่วคราว?

---

## กฎการทำงาน (NOVA workflow — เด็ดขาด)
- **NOVA (Opus ในแชท) = เขียน PLAN + audit เท่านั้น** เขียน PLAN ลง `docs/plans/`
- **Antigravity (บนเครื่อง Tony) = execute** surgical str_replace + verify + commit
- ทุกครั้ง Tony upload ไฟล์กลับให้ NOVA audit จริง (copy /home/claude/ + node --check + grep + diff)
- **var/function(){} เท่านั้น** (ES5, ห้าม let/const/arrow/template literal ใน index.html) · DOM ผ่าน el() · onclick ผ่าน data-* delegation · **ห้ามแก้ el() helper**
- `.gs` ใช้ const, CRLF
- surgical str_replace ห้าม regen · bump build stamp 3 จุด (meta ~line 12, title ~line 13, #buildVer ~line 3451 หลัง reformat) ทุกการแก้ client · stop-for-review ต่อ sub-task

## 🔴 Learnings จาก session HQ (graduate เข้า .agents/rules แล้ว)
1. **format-on-save = ศัตรู audit-by-diff** — `.vscode/settings.json` ปิด formatOnSave/Paste/Type แล้ว (แต่ index.html ถูก Prettier reformat ครั้งเดียว 3405→6318 บรรทัด = baseline ใหม่ semantically เท่าเดิม)
2. **upload ≠ disk ล่าสุด** — เจอ 4 รอบ! ก่อน upload เช็ค `Get-FileHash index.html -Algorithm MD5` เทียบ hash ที่ NOVA คาด ถ้าตรง=ไฟล์เก่า กด Ctrl+S ก่อน (editor dot ● = unsaved)
3. **`.gs` node --check** ต้อง copy เป็น `.js` ก่อน (ESM loader ปฏิเสธ .gs)

## Storage schema ปัจจุบัน (POS live — ห้ามพัง)
localStorage prefix `puff7_`, key `puff7_{safeBranch}_{dateStr}`
State: `{ branch, date, stock:{ID:{received_pieces,fry_out,sold}}, stock_log, sales, fry_log, withdrawals, damaged, free_items, pricePerPiece, lastStaff, gift_catalog, gift_stock, gift_sales, delivery_sales }`
Fillings master `F` = 11 ไส้ hardcode (ORI/SEA/BNN/CRN/PAP/CKC/CKH/SNC/HTN/CUC/CHO), 3-char uppercase
Carry-over ขึ้นวันใหม่: ยก stock เหลือ + price + gift catalog/stock จากวันก่อน

## Credentials
Owner exec `AKfycbxMbd0YD2KpUjk0DMYsLdVxGEj1BeCJchv12QmKdN454kMF5BCsIpnsipoTaAWQMOoD`
Owner SHEET_ID `1xvDAq2scrnd9H1XcQCeZoATcT_5EMftjWt94XPzz__w`
Franchise SHEET_ID `1f6v9eLTGVl8bMxFMWNetppcIpWsPKAPXr6UekzmO-ms`
TG_CHAT_ID `5566010745` (ทั้งคู่) · **ทุก .gs ใน repo ต้อง TG_BOT_TOKEN="" — token จริงวางใน Apps Script editor เท่านั้น (เคยหลุด 2 ครั้ง)**

## Backlog (หลังไส้พิเศษ)
- PDF คู่มือพนักงาน v3 (generator ถูกลบ ต้องสร้างใหม่ — ref v2: 7 หน้า ขาย/รับสต๊อก/delivery/ปิดวัน-เงินทอน/ขาด-เกิน/FAQ; เพิ่ม close-day-confirm + HQ tab)
- CRM (scope แล้ว ยังไม่เริ่ม): Branch Directory + Contract Tracker + expiry badge, Sheets backend, HQ 2-5 users, desktop
- optional: rotate TG token, repo → private
