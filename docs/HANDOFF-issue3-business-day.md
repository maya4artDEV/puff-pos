# HANDOFF — Issue 3: business-day / late-close · puff-pos · for FRESH chat

> วางข้อความนี้ใน chat เปล่าใหม่ + แนบ `index.html` (build 0009) + `SPEC-issue3-business-day.md` (ตัวเดิม — SPEC ground บน 0004 ต้อง re-audit).
> **Baseline เปลี่ยนแล้ว:** build **0009**, `index.html` MD5 **`441a9ed9cf85188bf3f9fedd7db602fd`** (ไม่ใช่ 0008/0004). SPEC เดิมทั้งหมดต้องเลื่อน anchor ตามตารางล่าง.

---

## 1. ปัญหา (จาก backlog)
สาขา event ที่ปิดยอดหลังเที่ยงคืน (เช่นเคลียร์ ~ตี 2) reconcile business-day ไม่ได้ — แอปตัดวันที่เที่ยงคืน, พอ reload → "วันนี้" กลายเป็นวันใหม่ → state ที่ค้างของเมื่อวานกลายเป็นวันอดีต = **view-only** (day-picker แก้ได้เฉพาะวันนี้), และ `save()` เขียนลง key ของวันใหม่.

**Interim workaround (ไม่ต้องโค้ด):** สาขาปิดดึกอย่า reload จนกว่าจะปิดยอดเสร็จ — in-memory state ยังอยู่วันธุรกิจที่ถูก, ยอดตี 2 filed ถูก.

## 2. Options + คำแนะนำ
- **A** = business-day cutoff offset (roll วันตอน ~ตี 5) → แตะ **ทุก** date-keyed field/export/carry-over = blast radius กว้างสุด
- **B** = ทำให้วันอดีต editable/closeable
- **C** = nudge on open ("ปิดวันเมื่อวานต่อไหม?") โหลดเมื่อวานเป็น active day
- **NOVA แนะนำ C** (risk ต่ำสุด, guide staff, ไม่แตะ date model ทั้งระบบ). Tony เอน B หรือ C.

## 3. 🎯 Smoking gun (re-audit บน 0009 — จุดแก้จริง)
```
save()  L4048–4053:
    localStorage.setItem(stateKey(currentBranch), payload);   // stateKey ไม่ส่ง dateStr → key = todayISO()
    queueCloudSync(currentBranch, todayISO(), S);              // ★ hardcode todayISO() ★
```
ทั้ง **local key และ cloud sync key ผูกกับ `todayISO()` ไม่ใช่ `S.date`** → นี่คือรากของบั๊ก. Rec C/B ต้องทำให้ key มาจาก **`S.date` (active business day)** ทุกจุด. นี่คือ edit เสี่ยงสุด — ต้อง surgical + test carry-over ไม่พัง.

## 4. Anchors re-audited (build 0009 — เลขบรรทัดจริง)
| สิ่งที่ต้องแตะ | 0009 line | หมายเหตุ |
|---|---|---|
| `function todayISO()` | 3907 | นิยาม |
| **todayISO() call sites รวม 9 จุด** | 3938, 3948, 3958, **4052**, 4568, 5902, 5985, 6524 (+def 3907) | SPEC เดิมลิสต์ 5 — **drift เป็น 9**. ต้องแยกว่าจุดไหนควรเป็น `S.date` จุดไหนคง `todayISO()` (เช่น 5985 = email date, 5902 = export filename — คงได้/แล้วแต่) |
| `save()` — local key + `queueCloudSync(...todayISO()...)` | **4048–4052** | ★ แก้เป็น `S.date`-aware ★ (SPEC เดิมอ้าง L4055) |
| `function queueCloudSync(branch, date, state)` | 6226 | รับ date param อยู่แล้ว — แค่ caller ต้องส่ง `S.date` |
| `function loadBranch(branch, dateStr)` | 4032 | รับ dateStr ได้แล้ว — path "ไม่มี dateStr = วันนี้ + carry-over" คือที่ต้องเพิ่ม nudge |
| `function newStateWithCarryOver(branch)` | 3988 | carry-over: frozen stock + price + fillingPrices + gift · **ระวังตอน back-date close ยอด carry-over ต้อง recompute** |
| `function setBranch(branch)` | 4054 | `S = loadBranch(branch)` (วันนี้เท่านั้น) → Rec C แทรก nudge ตรงนี้/หลัง login |
| `function newState(branch)` — `date: todayISO()` | 3948 | จุดที่ตั้ง `S.date` ครั้งแรก |
| day-strip render + `isToday` gate | 4482, 6524–6536 | UI ที่ทำวันอดีต view-only (`isToday = sDateCanon === today`) — Rec B/C ต้องปลดล็อควันที่เลือก |
| close flow: `confirmCloseDay()` + confirm dialog | 5615, 5630 | close ต้อง key off `S.date` |
| `isEmptyState()` guard (กัน push state ว่าง) | 6228 | คงไว้ — สำคัญตอน back-date เปิดอ่าน |

## 5. 3 decisions ค้าง (อยู่ใน SPEC-issue3-business-day.md — re-attach)
SPEC เดิมมี rows **3-D2 / 3-D3 / 3-D5** ที่ block อยู่ — เปิด SPEC ยืนยัน. แกนตัดสินที่เห็น:
- เลือก A / B / C (NOVA: C)
- nudge มองย้อนแค่เมื่อวาน หรือ unclosed day ใดๆ?
- ใช้ flag อะไรบอกว่า "วันนั้นปิดแล้ว" (close-lock มีใน .gs แล้ว — ใช้ตัวนั้น?)
- ปิดวันย้อนหลังแล้ว carry-over ของวันถัดไป recompute ยังไง (กันยอด double)

## 6. Guardrails (คงเดิม — POS)
- `createElement`/`el()` เท่านั้น · ห้าม innerHTML concat/template literal/arrow/`let`/`const` · ห้ามแก้ `el()`
- **ห้ามแก้ localStorage key format** `puff7_{safeBranch}_{normDate}` — Issue 3 เปลี่ยน **ค่า date ที่ใช้ key** ไม่ใช่ format
- `node --check` ก่อน present ทุกครั้ง · client เปลี่ยน = bump build stamp ×3 (0009 → 0010)
- Deploy client = MD5-gated file-swap (NOVA คำนวณ target MD5 sandbox) · `.gs` = paste block เข้า editor เท่านั้น (whole-file ล้าง TG token)
- ถ้าแตะ carry-over/date model → **test สาขาจริง**: ปิดวันปกติ, ปิดวันดึก (ข้ามเที่ยงคืน), carry-over วันถัดไปยอดตรง
- Context Hub: `ch-find "issue 3 business day" -Project puff-pos` ตอนเริ่ม

## 7. สถานะ ณ ตอน handoff
- ✅ email report direct-send **shipped** (build 0009, owner+franchise deployed V18, client pushed `f96e607`)
- ⏳ Issue 3 = งานนี้ (ยังไม่เริ่มโค้ด — SPEC re-audit ก่อน)
- ⏳ non-blocking: rotate PIN สาขา **WNY-04** (หลุด screenshot)

## 8. ข้อความแรกใน chat ใหม่
> "อ่าน HANDOFF-issue3-business-day.md (แนบ) + index.html (build 0009, MD5 441a9ed9) + SPEC-issue3-business-day.md (แนบ). งาน: Issue 3 business-day late-close, Rec C nudge-on-open. ก่อนแก้: verify local MD5 = 441a9ed9, แล้ว re-audit SPEC เดิม (ground บน 0004) ให้ตรง anchors 0009 ในตาราง §4 ก่อนเขียน PLAN. ตอบ 3 decisions §5 ก่อนลงโค้ด."
