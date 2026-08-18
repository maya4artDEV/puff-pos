# งานสำหรับ Antigravity — sync capture_log + rules ให้ครบตั้งแต่ Task 3 ถึง 7

Context: NOVA audit ทั้ง 5 task ผ่าน แต่ capture_log ยังไม่ได้เขียนบทเรียน + 3 pattern ของ agent เอง ยังไม่ graduate เป็น rule. งานนี้ทำ 2 ไฟล์ 1 commit.

## PART 1 — แก้ `docs/capture_log.md`

เปิดไฟล์ อ่านโครงเดิมก่อน. ใน section `## 2026-08-18` **บนสุด** (ก่อน entry เดิมทั้งหมด) เพิ่ม 5 entry ต่อไปนี้เรียงตามนี้:

### Entry 1
**Task 3 — read-path merge removal, grep audit confirms.** หลังลบ merge block ใน `prefetchCloudState`, grep ยืนยันว่า `doReplace/cScore/lScore` = 0 hits, `activityScore` เหลือแค่ใน `migrateBranchKeys`. ตัวบั๊กที่แก้มา 5 รอบไม่หาย ตอนนี้ต้นตอฝั่ง client ถูกตัดออกแล้ว รอ Task 5 ปิดฝั่ง server.
- Playwright test ที่ agent เขียนมี flaw: re-implement spec ใน test เอง แทนที่จะเรียก `prefetchCloudState()` จริง — grep audit จับได้แทน.
- Lesson: static grep audit หลัง surgical edit สำคัญไม่แพ้ automated test. Test ต้องเรียก function จริง ไม่ใช่จำลอง logic ซ้ำใน test body.

### Entry 2
**Task 5 — backend plain upsert, ต้องอ่านไฟล์เต็มไม่ใช่แค่ diff.** `diff` โชว์แค่ส่วนเปลี่ยน — ต้องเห็นบริบทรอบข้างว่า event handlers (sale/fry/gift_sale/state_get/state_list/state_latest) ยังอยู่ครบ ไม่มี regression. audit วิธี: `grep -c "data.type === \"<evt>\""` เทียบว่าครบทุก event ที่ live อยู่.
- Lesson: production backend audit = อ่านไฟล์เต็ม + grep นับ event handlers ทั้งหมด. Diff-only audit เสี่ยงพลาด removal โดยไม่ตั้งใจ.

### Entry 3
**Secrets — chat ก็ไม่วาง.** Tony เกือบส่ง `TG_CHAT_ID` (จริงๆ คือ token) มาแชทให้ NOVA แก้ให้. NOVA ปฏิเสธ. เหตุผล:
- chat ID กับ bot token คนละตัว — bot token = ยิงข้อความในนามบอตได้ = ปลอมระบบแจ้งเตือน
- ถ้าพิมพ์ใน chat = อยู่ใน context ถาวร + เสี่ยง copy กลับ commit
- graduate rule เดิม "never commit" → ครอบถึง "never share via chat" ด้วย
- ทางถูก: Tony วางเองในเบราว์เซอร์ 2 ที่ (Owner + Franchise Apps Script), ไฟล์ใน repo คง `TG_BOT_TOKEN = ""`
- → graduated → `.agents/rules/backend-appsscript.md` (Secrets section)

### Entry 4
**Task 6½ — no-cors trap + text/plain fix.** POST ที่ใช้ `mode:"no-cors"` = response opaque → client อ่านสถานะไม่ได้ → `.then()` fire แม้ server reject → queue drop entry = silent data loss. Fix: เปลี่ยน `mode:"cors"` + `Content-Type: "text/plain;charset=utf-8"` (ข้าม preflight ไม่ต้องแก้ Apps Script) + อ่าน `r.json()` แล้วเช็ค `d.ok` ก่อน remove queue.
- Apps Script `/exec` ตอบ 302 redirect — browser fetch handle เองได้ แต่ต้องเทสจริงหน้างานหลัง deploy
- Lesson: no-cors + .then = presumed success, ไม่ใช่ verified success. Production API calls ที่ต้องรู้ผล ต้องอ่าน response จริง.

### Entry 5
**Task 7 — HQ polling + guards ครบ ผ่าน audit เข้ม.** 5 guards ใน interval (currentTab/authed/hidden/inflight/online) + `stopHQPolling` wire 3 จุด (doLogout/go-leave-hq/self-stop) + `onDone` callback fires 6 exit paths ของ `refreshHQData`. Agent wire `doLogout` เพิ่มเองนอก PLAN (ถูกต้อง — กัน orphan timer ตอน logout ระหว่าง polling) — audit เต็มจับได้ แต่ agent ควรรายงานก่อนเพิ่ม scope.

## PART 2 — แก้ `.agents/rules/code-conventions.md`

เปิดไฟล์. หา section ที่มีอยู่หรือสร้างใหม่ชื่อ **"Agent workflow discipline (graduated from Task 5-7 captures)"** ต่อท้ายไฟล์ ใส่ 3 rules ต่อไปนี้:

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

## PART 3 — commit

```powershell
git add docs/capture_log.md .agents/rules/code-conventions.md
git commit -m "docs: sync capture_log + graduate 3 agent workflow rules (Task 3-7 batch)"
git log --oneline -3
```

ไม่แตะ index.html. ไม่แตะ .gs. ไม่ bump build stamp. งานนี้แก้ docs+rules อย่างเดียว.
