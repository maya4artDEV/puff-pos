# Capture Log — PuffStick POS

> Running journal for the compounding loop (Do → Capture → Upgrade). Append 2–4 lines per entry.
> This is **history**, not enforcement. When a capture recurs or is load-bearing, **graduate** it into `.agents/rules/` so the agent enforces it every session. Mark it `→ graduated` here.
> Newest on top. This file is read on demand, not every session.

---

## 2026-08-20

**sync fix VERIFIED หน้างานจริง 20/08** — T2 (viewer read-only ยิง Telegram ไม่ได้) + T8 (cross-device ตรง, Sheet 1 แถว/สาขา, upsert+normDate ทำงาน).
ปิดบั๊ก 5 เดือนที่ต้นตอ Sheets date coercion.
เรียนรู้: HQ ไม่มีช่องทอดตรงๆ แสดงผ่านแช่แข็ง(=recv-fry_out); viewer block ทุก write = read-only จริง

**Task 10 — Sheets date coercion = ต้นตอจริงของ cross-device mismatch.** Google Sheets แปลง "dd/MM/yyyy" ที่ day<=12 เป็น Date object อัตโนมัติ (locale MM/DD → "12/07" กลายเป็น ธ.ค. 7).
พัง 3 ชั้น: (1) state_save match `rows[i][1] === data.date` = Date !== string → หา row ไม่เจอ → append รัวเป็นร้อยแถว
(2) เขียนแล้วโดนสลับ เดือน/วัน (3) state_list คืน Date raw → JSON เป็น ISO → HQ sort เป็นอนาคต.
Fix: normDate() แปลง Date+string เป็น canonical "dd/mm/yyyy" ใช้ตอน match + read + setNumberFormat("@") กัน coercion.
บทเรียนใหญ่: แก้ client 9 รอบไม่หายเพราะบั๊กอยู่ชั้น server date ที่ไม่เคยเจาะ. Audit Task 5 พลาดเพราะเช็คแค่ scoreState หาย ไม่ไล่ logic การ match date. → Rule: audit backend ต้องไล่ทั้ง read + write + match path ไม่ใช่แค่ "ฟังก์ชันที่ถูกลบ".

**ไฟล์แนบชื่อซ้ำ = ได้ไฟล์เดียว.** อัปโหลดไฟล์ชื่อเดียวกัน 2 ไฟล์ (Code.gs Owner + Franchise) พร้อมกัน → ระบบเก็บได้ไฟล์เดียว (ตัวหลังทับ).
เกิดซ้ำ 2 ครั้งใน session นี้. → ต้อง rename ก่อนแนบ (Code_Owner.gs / Code_Franchise.gs) หรือ zip.
NOVA ต้อง md5/identify ไฟล์ก่อนสรุปว่า "ได้กี่ไฟล์" ไม่เชื่อจำนวน file_path tag.

**Batch test เจอ 4 latent bug ที่ 8-task chain ไม่ครอบ.** viewer ยิง Telegram (spec Task 2 แคบ) + HQ date string-compare + ISO garbage + isToday.
บทเรียน: acceptance test หน้างานจริงจับ bug ที่ unit/static ไม่เจอ — โดยเฉพาะ integration ข้าม client↔sheet.

---

## 2026-08-18

**Task 7 — HQ polling + guards ครบ ผ่าน audit เข้ม.** 5 guards ใน interval (currentTab/authed/hidden/inflight/online) + `stopHQPolling` wire 3 จุด (doLogout/go-leave-hq/self-stop) + `onDone` callback fires 6 exit paths ของ `refreshHQData`. Agent wire `doLogout` เพิ่มเองนอก PLAN (ถูกต้อง — กัน orphan timer ตอน logout ระหว่าง polling) — audit เต็มจับได้ แต่ agent ควรรายงานก่อนเพิ่ม scope.

**Task 6½ — no-cors trap + text/plain fix.** POST ที่ใช้ `mode:"no-cors"` = response opaque → client อ่านสถานะไม่ได้ → `.then()` fire แม้ server reject → queue drop entry = silent data loss. Fix: เปลี่ยน `mode:"cors"` + `Content-Type: "text/plain;charset=utf-8"` (ข้าม preflight ไม่ต้องแก้ Apps Script) + อ่าน `r.json()` แล้วเช็ค `d.ok` ก่อน remove queue.
- Apps Script `/exec` ตอบ 302 redirect — browser fetch handle เองได้ แต่ต้องเทสจริงหน้างานหลัง deploy
- Lesson: no-cors + .then = presumed success, ไม่ใช่ verified success. Production API calls ที่ต้องรู้ผล ต้องอ่าน response จริง.

**Secrets — chat ก็ไม่วาง.** Tony เกือบส่ง `TG_CHAT_ID` (จริงๆ คือ token) มาแชทให้ NOVA แก้ให้. NOVA ปฏิเสธ. เหตุผล:
- chat ID กับ bot token คนละตัว — bot token = ยิงข้อความในนามบอตได้ = ปลอมระบบแจ้งเตือน
- ถ้าพิมพ์ใน chat = อยู่ใน context ถาวร + เสี่ยง copy กลับ commit
- graduate rule เดิม "never commit" → ครอบถึง "never share via chat" ด้วย
- ทางถูก: Tony วางเองในเบราว์เซอร์ 2 ที่ (Owner + Franchise Apps Script), ไฟล์ใน repo คง `TG_BOT_TOKEN = ""`
- → graduated → `.agents/rules/backend-appsscript.md` (Secrets section)

**Task 5 — backend plain upsert, ต้องอ่านไฟล์เต็มไม่ใช่แค่ diff.** `diff` โชว์แค่ส่วนเปลี่ยน — ต้องเห็นบริบทรอบข้างว่า event handlers (sale/fry/gift_sale/state_get/state_list/state_latest) ยังอยู่ครบ ไม่มี regression. audit วิธี: `grep -c "data.type === \"<evt>\""` เทียบว่าครบทุก event ที่ live อยู่.
- Lesson: production backend audit = อ่านไฟล์เต็ม + grep นับ event handlers ทั้งหมด. Diff-only audit เสี่ยงพลาด removal โดยไม่ตั้งใจ.

**Task 3 — read-path merge removal, grep audit confirms.** หลังลบ merge block ใน `prefetchCloudState`, grep ยืนยันว่า `doReplace/cScore/lScore` = 0 hits, `activityScore` เหลือแค่ใน `migrateBranchKeys`. ตัวบั๊กที่แก้มา 5 รอบไม่หาย ตอนนี้ต้นตอฝั่ง client ถูกตัดออกแล้ว รอ Task 5 ปิดฝั่ง server.
- Playwright test ที่ agent เขียนมี flaw: re-implement spec ใน test เอง แทนที่จะเรียก `prefetchCloudState()` จริง — grep audit จับได้แทน.
- Lesson: static grep audit หลัง surgical edit สำคัญไม่แพ้ automated test. Test ต้องเรียก function จริง ไม่ใช่จำลอง logic ซ้ำใน test body.

**`el()` + `onclick: function(){}` = ปุ่มตายเงียบ.** `el()` ไม่มี case สำหรับ `onclick` → function value ตกไป `setAttribute("onclick", fn)` → stringify หลุด closure → ปุ่ม throw ตอนคลิก (`opt is not defined`) โดยไม่มี error โชว์ในหน้าจอ
- Fix: `data-*` attribute + delegated `addEventListener` บน container
- → graduated → `.agents/rules/code-conventions.md` (event handlers via `el()`)

**Static check ไม่ใช่การเทส event handler.** `node --check` / brace-balance ยืนยันแค่ว่า parse ผ่าน ไม่ได้ยืนยันว่าคลิกแล้วทำงาน. interactive element ต้องคลิกจริงในเบราว์เซอร์ถึงถือว่า task ผ่าน
- → reinforces: browser click test เป็น done-criteria ของทุก interactive element ที่สร้างผ่าน `el()` — ไม่ใช่ optional

## 2026-08-18

**`git amend` does not un-expose a pushed secret on a public repo.** After blanking the token and force-pushing, `main` was clean — but the original commit `0a4ab45` was still fetchable by SHA on GitHub and still served the live token (verified via raw.githubusercontent, HTTP 200). The repo was public the whole time.
- Wrong assumption (the agent's): clean `git log` = secret gone. It isn't — GitHub retains dangling commits by SHA; you can't self-purge them.
- Fix: **rotating the secret is the only real remediation.** Repo cleanup is cosmetic once something has been pushed public. Also flip the repo to private to stop exposing HANDOFF exec URLs / Sheet IDs.
- → reinforces `.agents/rules/backend-appsscript.md` "Secrets — never commit" (prevention is the only cheap option; cleanup after a public push is not).

**Secret committed via copied file.** Copied the user's `Code_Owner_v7.gs` / `Code_Franchise_v7.gs` into `backend/` verbatim → the live `TG_BOT_TOKEN` was committed and force-pushed to GitHub.
- Wrong assumption: a deny-rule against committing secrets covers files I *write*, but I applied it to nothing I *copied*.
- Fix: strip secrets from any file before committing it, copied or not. Token rotated in BotFather; blanked in repo.
- → graduated → `.agents/rules/backend-appsscript.md` ("Secrets — never commit").

**File-number bumping vs git SSOT.** The chat-era habit of bumping `puff-vN.html` every delivery existed only because there was no version control.
- Decision: `index.html` is the single deployable; version = in-file build stamp + git history. No parallel `puff-vN.html` in the repo.
- → reflected in `.agents/rules/deploy-and-production.md`.

**"pushed" ≠ "live".** After a GitHub Pages push, the build stamp must be verified on the live URL with `?nocache=` before calling deploy done (Fastly cache + Pages build delay).
- → reflected in the deploy runbook (Gate 4).
