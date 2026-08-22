# HANDOFF BRIEF — HQ Access Control (Server PIN) — เปิดแชทใหม่ทำต่อ

## สถานะ ณ ตอนปิดแชทเก่า
- POS live: `https://maya4artdev.github.io/puff-pos/` · repo `maya4artDEV/puff-pos` branch main
- Local: `D:\##PROJECT##\#1 92 KUMIMP\HTML\Anti IDE Project\puff-pos`
- Build ล่าสุด live = `20260820.2354` (force-sync ☁ + HQ ทอดวันนี้ + micro-fix input/แพ็ค)
- **Sync fix 5 เดือน ปิดจบแล้ว** (Task 10 = server normDate แก้ Sheets date coercion) — verified หน้างาน T2+T8 pass
- Apps Script: Owner + Franchise redeploy ไปแล้วรอบล่าสุด (มี normDate + fryPieces)
- ทุก .gs ใน repo ต้อง `TG_BOT_TOKEN = ""` (token จริงวางใน Apps Script editor เท่านั้น — เคยหลุด 2 ครั้ง ระวัง)

## งานที่จะทำต่อ: ล็อก HQ ไม่ให้พนักงานเข้า (Tony เลือก "ชั้น 1 + Server PIN")

### ปัญหา
HQ tab ตอนนี้ใครก็ตั้ง PIN เองได้ (`renderHQSetupPin` → `localStorage puff10_hqPin`) = พนักงานเข้าเห็นยอดทุกสาขา. login ไม่มี identity จริง (แค่ชื่อ+เบอร์+เลือกสาขา)

### ทางแก้ที่ Tony อนุมัติ = 2 ส่วน
**ส่วน A — client (index.html):**
1. ลบ `renderHQSetupPin` ทิ้ง (ห้ามตั้ง PIN เอง)
2. ซ่อนปุ่ม HQ tab เมื่อ `getDeviceMode() === "writer"` — แก้ที่ render ของ tab button `#tab-hq` (บรรทัด ~831 `<button id="tab-hq" onclick="go('hq')">`) + อาจต้องกันใน `go()` ถ้า writer พิมพ์ URL ตรง
3. เปลี่ยน `renderHQEnterPin` (บรรทัด ~3300) จากเทียบ `btoa(inp.value)===localStorage puff10_hqPin` → **POST PIN ไป Apps Script แล้วรอ `{ok:true}`**
4. เก็บ session เดิม (`puff10_hqSession` 8 ชม.) ได้ แต่ PIN ไม่เก็บ client อีก

**ส่วน B — server (.gs ทั้ง Owner + Franchise):**
1. เพิ่ม event `hq_auth` ใน doPost: รับ `{type:"hq_auth", pin:"xxxx"}` → เทียบกับ PIN ใน `PropertiesService.getScriptProperties().getProperty("HQ_PIN")` → return `{ok:true/false}`
2. Tony ตั้ง `HQ_PIN` ใน Apps Script → Project Settings → Script Properties (ไม่อยู่ใน source เลย)
3. ต้อง redeploy ทั้ง 2 script (New version)

### จุดสำคัญใน code (ground ไว้แล้ว build 2354)
- tab button HQ: line ~831 `<button class="tab-btn" id="tab-hq" onclick="go('hq')">`
- TABS array: line 1303 `var TABS = ["home","sell","fry","stock","close","hist","hq"];`
- go() จัดการ tab: line 1377 `if (tab==="hq"){renderHQTab();}`
- checkHQAuth: line ~3270 (อ่าน puff10_hqPin + puff10_hqSession 8hr)
- renderHQSetupPin (ลบทิ้ง): เริ่ม ~line 3290
- renderHQEnterPin (เปลี่ยนเป็น server): ~line 3300+ (ปัจจุบัน `entered=btoa(inp.value); if(entered===stored)`)
- OWNER_URL: line 912 · getSheetURL(): line 948 · getSyncURL(branch): line 3059
- POST pattern ที่ใช้อยู่แล้ว (Task 6½): `fetch(url,{method:"POST",mode:"cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({...})}).then(r=>r.json())`

## วิธีทำงาน (สำคัญ — NOVA workflow)
- **NOVA (Opus ในแชท) = เขียน PLAN + audit เท่านั้น** — เขียน PLAN file ลง `docs/plans/` ให้ Antigravity ไปทำ
- **Antigravity (Sonnet บนเครื่อง Tony) = execute** surgical str_replace + node --check + commit
- ทุกครั้ง Tony upload ไฟล์กลับให้ NOVA audit จริง (copy ไป /home/claude/ + node --check + grep) — ไม่เชื่อคำ agent
- **กฎเด็ดขาด:** var/function(){} เท่านั้น (ES5, ห้าม let/const/arrow/template literal) · DOM ผ่าน el() helper · onclick ผ่าน data-* + delegation (ห้าม onclick:function) · node --check ก่อน present ทุกครั้ง · surgical str_replace ห้าม regen ทั้งไฟล์ · bump build stamp 3 จุด (meta line 11, title line 12, #buildVer line 620) ทุกการแก้ client · stop-for-review ต่อ sub-task
- **Agent มี pattern ต้องเฝ้า:** ชอบรวม sub-task (ต้องหยุดตาม PLAN), เพิ่ม scope เงียบๆ (ต้องรายงานก่อน), อ้าง "Playwright pass" ด้วย test เก่า → 3 rule นี้ graduate ใน `.agents/rules/code-conventions.md` แล้ว
- **ไฟล์แนบชื่อซ้ำ = ได้ไฟล์เดียว** → rename ก่อนแนบเสมอ (เช่น Code_owner.gs / Code_franchise.gs)
- credentials: Owner exec `AKfycbxMbd0YD2KpUjk0DMYsLdVxGEj1BeCJchv12QmKdN454kMF5BCsIpnsipoTaAWQMOoD` · Owner SHEET_ID `1xvDAq2scrnd9H1XcQCeZoATcT_5EMftjWt94XPzz__w` · Franchise SHEET_ID `1f6v9eLTGVl8bMxFMWNetppcIpWsPKAPXr6UekzmO-ms` · TG_CHAT_ID `5566010745` (ทั้งคู่)

## Backlog (หลัง HQ lock)
- PDF คู่มือพนักงาน v3 (generator v2 ถูกลบแล้ว ต้องสร้างใหม่ — reference: output v2 มี 7 หน้า ขาย/รับสต๊อก/delivery/ปิดวัน-เงินทอน/ขาด-เกิน/FAQ; ต้องเพิ่มปุ่ม close-day-confirm + HQ tab)
- CRM (scope แล้ว ยังไม่เริ่ม): Branch Directory + Contract Tracker + expiry badge, Google Sheets backend, HQ 2-5 users, desktop
- optional: rotate TG token ที่เคย public, ทำ repo เป็น private

## First message ที่แนะนำให้พิมพ์ในแชทใหม่
"อ่าน HQ-LOCK-BRIEF.md (แนบ) — ทำงาน HQ access control ต่อ. เขียน PLAN ให้ Antigravity: ส่วน A (client: ลบ self-set PIN, ซ่อน HQ tab บน writer, เปลี่ยน enter-PIN เป็น server POST) + ส่วน B (.gs: เพิ่ม hq_auth event เทียบ Script Property HQ_PIN). ground code ก่อนจาก index.html + Code.gs ที่จะแนบให้"
