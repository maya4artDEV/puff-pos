# PuffStick POS — Handoff (สำหรับเปิดแชทใหม่)

> วางไฟล์นี้ในแชทใหม่เป็นข้อความแรก แล้วบอกว่า "อ่าน handoff นี้ก่อน แล้วรอโจทย์"

---

## 1. สถานะปัจจุบัน

**Production:** `index.html` — build `20260819.1027`
**Deploy:** GitHub Pages → https://maya4artdev.github.io/puff-pos/ (repo `maya4artDEV/puff-pos`, ไฟล์ชื่อ `index.html`)
**Backend:** Google Apps Script v8 (Owner + Franchise แยก 2 script) + Google Sheets — v8 เพิ่ม normDate() แก้ date coercion (redeploy Owner+Franchise แล้ว)

### Deploy URLs (ห้ามเปลี่ยน — deploy ต้องใช้ "Manage deployments → ✏️ → New version" เท่านั้น)
- Owner: `https://script.google.com/macros/s/AKfycbxMbd0YD2KpUjk0DMYsLdVxGEj1BeCJchv12QmKdN454kMF5BCsIpnsipoTaAWQMOoD/exec`
- Franchise: `https://script.google.com/macros/s/AKfycbzeHh3ouj782znH-gQemvoH733fQjrQZPWFiesTZU3Hzum4coiEWb2ZAwoC1kPPFM-NDQ/exec`
- Owner Sheet ID: `1xvDAq2scrnd9H1XcQCeZoATcT_5EMftjWt94XPzz__w`
- Franchise Sheet ID: `1f6v9eLTGVl8bMxFMWNetppcIpWsPKAPXr6UekzmO-ms`
- Telegram Chat ID: `5566010745` (bot token เปลี่ยนแล้ว — อยู่ใน Apps Script)
- Franchise TG_CHAT_ID: ตั้งจริงแล้ว = `5566010745` (ไม่ใช่ placeholder — ตั้งใน Franchise Apps Script แล้ว)

---

## 2. ค้างอยู่ — ทำต่อทันที

| # | งาน | รายละเอียด |
|---|---|---|
| 1 | **Retest cross-device หน้างาน** | Deploy + normDate() ใน v8 แก้ bug หลักแล้ว — retest field จริงว่าตรง |
| 2 | **คู่มือ PDF v3** | ยังไม่ได้ทำ — ต้องเพิ่ม: ปุ่มยืนยันปิดวัน, Delivery, HQ tab |
| 3 | **CRM** | scope ไว้แล้ว — รอ kickoff |

---

## 3. Bug chain ที่แก้ไปแล้ว (อย่าแก้ซ้ำ / อย่า regress)

ปัญหา "แต่ละเครื่องเห็นสต๊อกไม่ตรงกัน" มี **6 ชั้นซ้อนกัน** ทั้งหมดแก้แล้ว:

1. **String sort วันที่** — `dd/mm/yyyy` sort แบบ string ทำให้ 30/6 มาหลัง 1/7 → fix: `dateNum()` เทียบเป็นตัวเลข
2. **`pieces || packs*10`** — `received_pieces === 0` เป็น falsy → ตกไป fallback ได้เลข ×10 → fix: `!== undefined` check + รวมเป็น `getStockForState()` ตัวเดียว (SSOT)
3. **Empty-state poisoning** — เครื่องที่แค่เปิดดู push state 0 ทับ cloud → fix: `isEmptyState()` guard ทั้ง client + server (`scoreState` ใน GS v7)
4. **Sync แค่ตอน login** — เปิดแอปค้างทั้งวันไม่เคย refresh → fix: `refreshFromCloud()` บน `pageshow` + `visibilitychange` (throttle 1/นาที)
5. **Date-key mismatch** ⭐ — Google Sheets ตัด leading zero (`04/07` → `4/7`) ทำให้ cloud data ถูกวางใน key ที่แอปไม่อ่าน → fix: `normDateStr()` normalize ทุก date ก่อนทำ key + `migrateBranchKeys()` รวม key เพี้ยนเก่า
6. **Sheets date-type coercion (Task 10)** ⭐ — Sheets แปลง "dd/MM/yyyy" ที่ day≤12 เป็น Date object (locale MM/DD) → `rows[i][1] === data.date` = Date !== string → หา row ไม่เจอ → append แถวรัว + ISO date เข้า JSON → HQ sort เป็นอนาคต → fix: `normDate()` ใน Apps Script v8 แปลง Date+string → canonical dd/mm/yyyy + `setNumberFormat("@")` กัน coercion

**Merge policy ปัจจุบัน:** state ที่ "รวยกว่า" ชนะ (`activityScore` = จำนวน sales/fry/stock logs + ยอดสต๊อกรวม) — timestamp ใช้ตัดสินเฉพาะเมื่อ score เท่ากัน บังคับใช้ทั้ง client และ server

---

## 4. Features ที่มีใน v12

- 7 tabs: หน้าหลัก · ขาย · ทอด · สต๊อก · ปิดวัน · ย้อนหลัง · HQ
- **HQ tab** — PIN (ตั้งครั้งแรกในแอป, session 8 ชม.) → dashboard ทุกสาขาผ่าน `state_list`
- **Delivery** — inline section ในหน้าขาย (ก่อนของฝาก) + shortcut: เลือกแอป (Grab/LineMan/Robinhood/ShopeeFood/อื่นๆ), Gross+Net, ระบุไส้, แนบภาพ (resize 800px q0.7 → Google Drive), Telegram
- **ปุ่มยืนยันปิดวัน** — set `is_closed:true` + `closedAt`; carry-over จะเลือก state ที่ `is_closed` ก่อน (fallback = ล่าสุด)
- **รับสต๊อก = ชิ้นเท่านั้น** (ลบช่องแพ็คแล้ว)
- **calcClose** รวม `gift_sales` + `delivery_sales` ใน expected + แสดง breakdown
- **Excel export** — มี sheet `Delivery` + ยอด Delivery/ของฝากในหน้าปิดวัน; XLSX โหลดแบบ lazy ผ่าน 3 CDN fallback (cdnjs → jsdelivr → unpkg, timeout 8 วิ/ตัว)
- Cloud sync: `state_save` / `state_get` / `state_list` / `state_latest`
- Sync icon ☁✓ / ☁⟳ / ☁✗ ใต้นาฬิกา + build stamp

---

## 5. กติกาการทำงาน (Tony's rules — ต้องทำตาม)

**Code conventions (POS เท่านั้น — ต่างจาก Order project):**
- `var` เท่านั้น ห้าม `let`/`const`, ห้าม arrow function, ห้าม template literal
- สร้าง DOM ผ่าน `el()` helper เท่านั้น — **ห้ามแก้ `el()`** และห้าม innerHTML concat
- localStorage prefix `puff7_` — ห้ามเปลี่ยน key format
- Filling IDs uppercase 3 ตัว (`ORI`,`SEA`,...) · Branch codes `XXX-NN` · Event ขึ้นต้น `E`

**Workflow:**
- `node --check` + brace balance **ก่อน present ทุกครั้ง** ห้ามข้าม
- `str_replace` ทีละจุด — ห้าม regenerate ทั้งไฟล์
- Diff > 100 บรรทัด = approach ผิด → หยุด rethink
- **เปลี่ยนเลขไฟล์ทุกครั้งที่ส่ง** (v12 → v13 → ...) + bump build stamp
- No blind patching — ถ้า logic เดิมผิดฐานคิด ให้บอกว่าต้องรื้อ พร้อมเหตุผล
- ทุก 5 turn หรือเปลี่ยนหัวข้อ → สรุป Current State of Progress
- ตอบไทย, code/docs อังกฤษ, ตรงจุด ไม่เกริ่น ไม่ขอโทษเกินจำเป็น

**บทเรียนที่เสียเวลาไปแล้ว — อย่าทำซ้ำ:**
- อย่าสรุปจากภาพ screenshot โดยไม่อ่านให้ครบ (เคยอ่าน column ผิด → RCA ผิด 2 รอบ)
- อย่าโทษ user ก่อนตรวจไฟล์ตัวเอง (`grep` build stamp ในไฟล์ที่ส่งจริงก่อนพูด)
- GitHub Pages มี CDN cache (Fastly) แยกจาก browser cache → test ด้วย `?nocache=N`
- PWA/WebClip cache ดื้อ → ลบ shortcut แล้ว add ใหม่ ถ้า build ไม่เปลี่ยน

---

## 6. ข้อมูลที่ต้องรู้เรื่อง data

- ยอดสต๊อกจริงของ 1/7–2/7 อยู่**เฉพาะในเครื่องสาขาทับกวาง** — ไม่เคยขึ้น cloud (ตอนนั้นสาขารัน build เก่าที่ยังไม่มี sync) ประวัติบน cloud เริ่มนับจากวันที่สาขา sync สำเร็จครั้งแรก
- CloudState sheet: `branch | date | updated_at | state_json` (tab ข้างๆ Sales)
- ถ้าต้องล้าง row เสีย: ลบเฉพาะ row ที่ `state_json` เป็น 0 ล้วน — เก็บ row ที่มี received เยอะจริง

---

## 7. ระบบอื่นในจักรวาล PuffStick (อย่าปนกัน)

| ระบบ | Backend | Prefix/ID | หมายเหตุ |
|---|---|---|---|
| **POS** (นี่) | Apps Script + Sheets | `puff7_`, `ORI`/`SBR-01` | ห้ามใช้ Firebase |
| **Order** (คนละ project) | Firebase | `ps_`, `orig`/`b01` | Telegram bot คนละตัว |
| **CRM** | ยังไม่เริ่ม | — | scope ไว้แล้ว: Branch Directory + Contract Tracker (badge เตือนใกล้หมด), Google Sheets, desktop browser, ทีม HQ 2-5 คน |

**CRM ที่ scope ไว้ (รอเริ่ม):** ตัด Contract Expiry Alert แยกหน้าออก (รวมเป็น badge), ตัด Notes ออก, ตัด sales tracking franchise ออก (ยังไม่มี data source)
