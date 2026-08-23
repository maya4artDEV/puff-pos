# HANDOFF — Per-Branch Login Access Control (SECURITY · เปิดแชทใหม่ทำ)

## First message ที่แนะนำพิมพ์ในแชทใหม่
> "อ่าน HANDOFF-branch-access.md (แนบ) — งาน SECURITY ด่วน: ตอนนี้ login POS ไม่มี auth ต่อสาขา ใครมีลิงก์เลือกสาขาไหนใน dropdown ก็เข้าได้ (SBR-01/TBK-02 ฯลฯ) = data exposure จริงที่เปิดอยู่. ต้องเพิ่มรหัสต่อสาขา (server-side PIN reuse pattern hq_auth). เขียน SPEC + PLAN ก่อน อย่าเพิ่ง code — แตะ access model + production 20+ สาขา + ทั้ง 2 .gs. ground index.html + owner.gs + franchise.gs ที่จะแนบ"

---

## 🔴 ปัญหา (severity: HIGH — live exposure)
POS login **ไม่มี authentication ต่อสาขา**:
- Login screen มี dropdown 5 สาขา owner (`SBR-01` สระบุรีหลัก / `TBK-02` ทับกวาง / `MVK-03` มวกเหล็ก / `WNY-04` วังน้อย / `BPI-05` บางปะอิน) + ช่องพิมพ์รหัสอิสระ `loginFreeInput` ("สาขาแฟรนไชส์ / Event")
- ใครก็ตามที่มีลิงก์ app → เลือกสาขาใดก็ได้ → **เข้าดู/บันทึกยอดสาขานั้นได้ทันที ไม่มีรหัส**
- แฟรนไชส์/คนนอกที่เคยได้ลิงก์ **อาจเคย login เข้าดูสระบุรี/ทับกวาง** มาแล้ว (เปิดใช้มานาน)
- gate เดียวที่มีตอนนี้ = `HQ_PIN` (แท็บ HQ ข้ามสาขาเท่านั้น) — ไม่ครอบคลุม login ระดับสาขา

**ต้องปิดช่องนี้ก่อน deploy durian** (ตามคำสั่ง Tony — แทรกงานนี้ก่อน)

---

## 🎯 เป้าหมาย
ทุกสาขา (owner preset + franchise custom) ต้องใส่ **รหัสสาขา (PIN)** ถึงจะ login เข้าเป็นสาขานั้นได้ → คนไม่มีรหัสเข้าไม่ได้

## แนวทางออกแบบ (reuse `hq_auth` pattern — server-side PIN)
> ⚠️ **ห้ามเก็บ PIN ใน client** (จะหลุดใน HTML = ไร้ประโยชน์ เหมือน bug HQ client-PIN เดิมที่เพิ่งแก้). PIN อยู่ **server PropertiesService เท่านั้น**

- **Server:** เก็บ PIN ต่อสาขาใน `PropertiesService` เช่น map JSON `BRANCH_PINS = {"SBR-01":"...", "TBK-02":"...", ...}`
  - owner branches → เก็บใน **OWNER** script properties
  - franchise codes → เก็บใน **FRANCHISE** script properties (route ตาม `getSyncURL`)
- **Login flow:** เลือก/พิมพ์สาขา → ใส่ PIN → POST `{type:"branch_auth", branch, pin}` ไป URL ที่ถูก (routing เดิม) → server เทียบ `BRANCH_PINS[branch]` → ผ่านถึง `setBranch()` + โหลดข้อมูล
- **Session:** session-only flag (แบบ `checkHQAuth`) — ไม่ persist PIN, re-auth เมื่อเปิดใหม่ (ตัดสินใจเรื่อง remember-device ด้านล่าง)
- **`.gs` ทั้ง 2 ตัวเพิ่ม `branch_auth` handler** (short-circuit ก่อน openById เหมือน `hq_auth`)

## 🔴 Threat model — ต้องเข้าใจก่อนตกลง scope
- **Threat 1 (ที่ Tony เจอ, realistic):** คนเปิด app UI → เลือกสาขาอื่นจาก dropdown → ดู/แก้ → **MVP นี้ปิดได้** (client login gate + server branch_auth)
- **Threat 2 (advanced):** คนยิง POST ตรงไป exec URL พร้อม branch code (ข้าม UI) → endpoint `state_save`/`state_get`/`sale`/`fry` **ยังไม่ check auth** → ต้อง harden server endpoints ให้ต้องแนบ PIN/token = **Phase 2 (defense in depth)**
- MVP = ปิด Threat 1 (ตรงกับ exposure จริง). Phase 2 = ปิด Threat 2. **ต้องยืนยันว่า MVP แค่ Threat 1 พอไหม**

---

## Decisions ที่ต้องเคาะก่อนเขียน SPEC
1. **ขอบเขต:** gate ทุกสาขา (owner 5 + franchise) ใช่ไหม? → rec: ใช่ (exposure คือ owner branches)
2. **ตั้ง PIN ยังไง:** HQ ตั้งเองใน Apps Script editor เป็น `BRANCH_PINS` JSON (เหมือน `HQ_PIN`) ก่อน, UI จัดการทีหลัง? → rec: manual ก่อน (เร็ว ปลอดภัย)
3. **Session:** re-auth ทุกครั้งเปิด app (ปลอดภัยสุด, มี friction) หรือ remember-device จน logout (สะดวก, เสี่ยงเครื่องหลุด)? → rec: remember จน logout + ปุ่ม logout ชัด
4. **สลับสาขา:** ล็อกที่สาขาที่ auth แล้ว, เปลี่ยน = logout + re-auth ใช่ไหม? → rec: ใช่
5. **MVP = Threat 1 พอไหม** (Threat 2 = Phase 2)? → rec: ใช่ ปิด exposure จริงก่อน
6. **Rollout (สำคัญ — live):** ต้อง**ตั้ง PIN ทุกสาขา + แจ้งสาขาที่ใช้อยู่ก่อน deploy** ไม่งั้นสาขาถูกล็อกออกหมด. ทำ comms plan + set `BRANCH_PINS` ให้ครบก่อน push client

---

## จุดที่กระทบในโค้ด (ground จริงก่อนเขียน PLAN)
- **index.html** — login flow: `loginBranchSel` dropdown (~line 3404), `loginFreeInput` (ช่องแฟรนไชส์), `onLoginSelectChange()`, `setBranch()` (~4003), `setDeviceMode()` (~4103), restore login (~5914 `puff8_lastBranch`/`puff10_loginStaff`). ต้องแทรก PIN gate ก่อน `setBranch` สำเร็จ
- **owner `.gs`** — เพิ่ม `branch_auth` handler (มี `hq_auth` เป็น template อยู่แล้ว ~line 47)
- **franchise `.gs`** — เพิ่ม `branch_auth` handler (ไฟล์นี้ยังขาด `gift_sale` + `TG_CHAT_ID` มีค่าแล้ว, `TG_BOT_TOKEN=""`)
- `BRANCH_CODES` array (index ~3812): SBR-01/TBK-02/MVK-03/WNY-04/BPI-05

---

## สถานะงานอื่น ณ ตอนนี้
- **DUR-001 (ไส้ทุเรียน ฿45):** ✅ **code-complete + audited T1-T8** (client + owner.gs + franchise.gs) — **ยังไม่ deploy**
  - index.html MD5 `C7A63683E607FED00E7AFC55411BCD44` (build `20260823.0216`)
  - owner.gs MD5 `F95554E499A910B9F06233FE860B5A83`
  - franchise.gs MD5 `EE1C7E88A435EB912FDC908DE0F53173`
  - [ยืนยัน: commit/push แล้วหรือยัง]
- **🔴 Blocker:** Owner Apps Script editor **เปิดไม่ขึ้น (โหลดค้าง/ขาว)** — ต้องแก้ก่อน deploy อะไรก็ตาม
  - ลอง: เปิดผ่าน Owner Sheet → Extensions → Apps Script · Incognito · เช็ค account index (`/u/0/` vs `/u/1/`) · [Google Workspace Status](https://www.google.com/appsstatus)
- **Deploy plan รวม:** branch-access .gs + durian .gs จะ redeploy ทีเดียว (owner + franchise New version) — ทำ branch-access ให้เสร็จ แล้ว deploy ทั้ง durian + branch-access พร้อมกัน (ลด deploy รอบ)
- **คู่มือพนักงาน v3:** ✅ 10 หน้า (Noto Sans Thai + brand ฟ้า/แดง/เหลือง) — มีหัวข้อ login/branch-code (พฤติกรรมปัจจุบัน) แล้ว → **ต้องอัปเดตเพิ่ม "รหัสผ่านสาขา" หลัง branch-access ลง**

---

## กฎการทำงาน (NOVA workflow — เด็ดขาด)
- **NOVA (Opus ในแชท) = เขียน SPEC + PLAN + audit** · **Antigravity = execute** surgical str_replace + verify + commit
- **hash-before-audit:** ทุกครั้งก่อน audit เทียบ MD5 กับที่ NOVA คาด ถ้าตรง baseline เก่า = ไฟล์ไม่ save (reject, ให้ Ctrl+S ก่อน) — เจอมาแล้ว 4+ ครั้ง
- **index.html:** ES5 เท่านั้น (`var`/`function(){}` ห้าม let/const/arrow/template literal) · DOM ผ่าน `el()` · onclick ผ่าน data-* delegation · **ห้ามแก้ `el()`**
- **`.gs`:** const, **CRLF**, **`TG_BOT_TOKEN=""` ต้องว่างใน repo เสมอ** (เคยหลุด 2 ครั้ง — token จริงอยู่ใน Apps Script editor)
- surgical str_replace ห้าม regen · **bump build stamp 3 จุด** (meta ~12, title ~13, `#buildVer` ~3451) ทุกการแก้ client · **stop-for-review ต่อ sub-task** · audit: copy `.gs`→`.js` ก่อน `node --check`
- **SPEC → PLAN → code** — ห้าม code ก่อน SPEC+PLAN reviewed (feature นี้ security + production sensitive)

## Credentials
- Owner exec `AKfycbxMbd0YD2KpUjk0DMYsLdVxGEj1BeCJchv12QmKdN454kMF5BCsIpnsipoTaAWQMOoD`
- Owner SHEET_ID `1xvDAq2scrnd9H1XcQCeZoATcT_5EMftjWt94XPzz__w`
- Franchise SHEET_ID `1f6v9eLTGVl8bMxFMWNetppcIpWsPKAPXr6UekzmO-ms` · Franchise exec URL แยก (ไม่เก็บที่นี่)
- TG_CHAT_ID `5566010745` (ทั้งคู่)
- repo `maya4artDEV/puff-pos` branch `main` · live `https://maya4artdev.github.io/puff-pos/`
- **PIN ต่อสาขา = server PropertiesService เท่านั้น ห้าม commit เข้า repo/client เด็ดขาด**
