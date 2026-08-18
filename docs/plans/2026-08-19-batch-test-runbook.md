# Batch Test — sync-fix รวบทุก Task (1-8)

**Build ที่เทส:** `20260819.0018` (verified live)
**อุปกรณ์ที่ใช้:** เครื่อง A = tablet สระบุรี (writer) · เครื่อง B = มือถือ Tony (จะสลับ writer/viewer ตาม test)
**ทั้งคู่:** เปิด `https://maya4artdev.github.io/puff-pos/` — **ห้ามใช้ shortcut home screen** (มี WebClip cache ดื้อ)

**กติกาบันทึกผล:** ทุก test เขียนสั้นๆ ในรูปแบบ `T1 PASS`, `T3 FAIL: <อธิบาย + screenshot>` ส่งกลับผมทีเดียวจบ

---

## SETUP (ทำครั้งเดียวก่อนเริ่ม)

- [ ] **A:** เปิดแอป → login "SBR-01 สระบุรี" → เห็น build `20260819.0018` มุมซ้ายบน
- [ ] **B:** เปิดแอปที่ URL เดียวกัน → **ยังไม่ login** (อยู่หน้า login screen)

---

## PART 1 — Task 1: Device Mode Toggle & Badge

- [ ] **T1.1** [B] หน้า login → กดปุ่ม **"👁 ดูอย่างเดียว"** → ปุ่มพื้นเหลือง (mustard) = **ปุ่มทำงาน**
- [ ] **T1.2** [B] refresh browser → กลับหน้า login → ยังเป็น "ดูอย่างเดียว" = **persist ผ่าน**
- [ ] **T1.3** [B] login "SBR-01" → มุมขวาบนเห็น **badge สีเหลือง "👁 ดูอย่างเดียว"** ข้าง ☁ = **badge ทำงาน**
- [ ] **T1.4** [B] กลับหน้า login → เปลี่ยนเป็น **"✏ ผู้บันทึก"** → login ใหม่ → badge เขียว "✏ ผู้บันทึก"

**ก่อนไป Part 2:** เครื่อง B ตั้งเป็น **viewer** ทิ้งไว้ (สำคัญ)

---

## PART 2 — Task 2: Viewer Hard-Gate (ห้ามยิง cloud)

- [ ] **T2.1** [B] (viewer) เปิด DevTools → Application → Local Storage → ลบ key `puff10_syncQueue`
- [ ] **T2.2** [B] (viewer) กดขาย 1 ออเดอร์ (ไส้อะไรก็ได้ 1 ชิ้น) → กด บันทึก
- [ ] **T2.3** [B] เปิด DevTools → Network → filter "script.google" → **ต้องไม่มี request ยิงออก** = viewer gate ทำงาน
- [ ] **T2.4** [B] Local Storage → `puff10_syncQueue` = **`[]` (ว่าง)** หรือ **ไม่มี key** = ไม่ enqueue

---

## PART 3 — Task 3: Read Path (writer ไม่โดน cloud ทับ)

- [ ] **T3.1** [A] (writer) กดขาย 3 ออเดอร์ (ไส้ต่างกัน) → รอ ☁✓ ปรากฏ
- [ ] **T3.2** [A] กดค้างการ์ด "สต๊อกแช่แข็ง" ~0.7 วิ → screenshot **RAW STOCK STATE** (บันทึกไว้เทียบ)
- [ ] **T3.3** [B] เปลี่ยนเป็น **"✏ ผู้บันทึก"** → login "SBR-01" (สาขาเดียวกัน)
- [ ] **T3.4** [B] กดขาย 2 ออเดอร์ต่างจาก A → บันทึก
- [ ] **T3.5** [A] refresh browser → กดค้างการ์ดสต๊อก → RAW STATE **ต้องยังเห็น 3 ออเดอร์เดิม** (ไม่หายไปกลาย 2 ของ B) = writer ไม่โดน cloud ทับ ✓
- [ ] **T3.6** [B] refresh → RAW STATE ของ B ยังเห็น 2 ออเดอร์ของตัวเอง

*(ปกติ scenario นี้ = "2 writer สาขาเดียวกัน" ซึ่ง PLAN บอกห้าม — แต่เทสเพื่อยืนยันว่าไม่มีใครโดนกลืน. หลัง test นี้ให้ B กลับเป็น viewer)*

**หลัง T3 เสร็จ:** เครื่อง B กลับเป็น **viewer** (สภาพจริงที่ใช้งาน)

---

## PART 4 — Task 5: Backend Plain Upsert (redeployed)

- [ ] **T4.1** [A] (writer) กดขาย 1 ออเดอร์ → รอ ☁✓
- [ ] **T4.2** เปิด **Google Sheet Owner** → tab `CloudState` → ดู row `SBR-01 · วันนี้`
- [ ] **T4.3** column `updated_at` = **เวลาไม่กี่วินาทีที่แล้ว** = upsert ทำงาน ✓
- [ ] **T4.4** column `state_json` = JSON ยาวๆ ไม่ใช่ `{}` หรือ 0-only ✓
- [ ] **T4.5** [A] Telegram — ต้องเด้งข้อความแจ้งเตือนการขาย = TG_BOT_TOKEN ถูก + Telegram flow ยังทำงาน

---

## PART 5 — Task 6½: CORS + Text/Plain + Response Verified

- [ ] **T5.1** [A] เปิด DevTools → Network → filter "script.google" → กดขาย 1 ออเดอร์
- [ ] **T5.2** ดู request ล่าสุด → คลิกดู Headers:
    - `Request Method: POST`
    - `Content-Type: text/plain;charset=utf-8` ✓
    - **NOT** `no-cors`
- [ ] **T5.3** ดู Response tab → เห็น JSON `{"ok":true,...}` = **อ่าน response ได้จริง** (ไม่ opaque) ✓
- [ ] **T5.4** [A] ทดสอบ offline queue drain:
    - ปิด wifi + 4G (airplane mode)
    - กดขาย 2 ออเดอร์ (ไส้ต่างกัน) → ควรเห็น ☁⟳ หรือ ☁✗
    - เปิด Local Storage → `puff10_syncQueue` = มี 1 entry (coalesce แล้ว, ไม่ใช่ 2)
    - เปิดเน็ตกลับ → รอ ~5 วิ → ☁✓ กลับมา
    - เปิด Local Storage → `puff10_syncQueue` = `[]` (drain แล้ว) ✓
    - เปิด Google Sheet → row updated_at = เวลาไม่กี่วิที่แล้ว ✓

---

## PART 6 — Task 7: HQ Dashboard 60s Polling

- [ ] **T6.1** [B] (viewer) → เข้า tab **HQ** → ใส่ PIN → เห็น dashboard สาขา
- [ ] **T6.2** [A] (ระหว่าง B ค้างที่ HQ) → กดขาย 1 ออเดอร์ใหม่
- [ ] **T6.3** [B] **รอไม่เกิน 60 วินาที** → dashboard **อัปเดตยอด SBR-01 อัตโนมัติ** (โดยไม่ต้องกด "รีเฟรช") ✓
- [ ] **T6.4** [B] Open DevTools → Network → filter "state_list" → ต้องเห็น request ยิงทุก ~60 วิ (ไม่ใช่ทุกวินาที)
- [ ] **T6.5** [B] สลับไปแท็บ **"หน้าหลัก"** → รอ 2 นาที → กลับดู Network → **ไม่มี state_list ยิงเพิ่ม** = stopHQPolling ทำงาน ✓
- [ ] **T6.6** [B] กด "ออกจากระบบ" → ยิ่งไม่มี state_list เพิ่ม ✓
- [ ] **T6.7** [B] ล็อคหน้าจอโทรศัพท์ค้าง 2 นาที (ระหว่างอยู่ tab HQ) → ปลดล็อค → Network history ไม่ควรมี tick ตอนที่ล็อค (document.hidden guard)

---

## PART 7 — Task 8: Migration Edge (การ merge non-canonical date keys)

*(test นี้เชิงเทคนิค — ถ้าไม่มี key เพี้ยนใน localStorage ก็ไม่ trigger. skip ได้ ถ้ายังไม่เจอ)*

- [ ] **T7.1** [A] DevTools Local Storage → หา key รูปแบบ `puff7_SBR-01_X/X/YYYY` (ไม่มี leading zero) → ถ้ามี = ยัง trigger migration ได้
- [ ] **T7.2** ถ้าไม่มี key เพี้ยน → บันทึก "T7 SKIP: no legacy keys to migrate"

---

## PART 8 — Real-World Cross-Device (โจทย์เดิมที่พังมา 5 รอบ)

**นี่คือ test ที่สำคัญที่สุด** — คือเคสจริงที่พี่ทำมา 5 รอบไม่หาย:

- [ ] **T8.1** [A] (writer) กดขาย 5 ออเดอร์รวด → รอ ☁✓
- [ ] **T8.2** [B] (viewer) refresh browser → login เข้า → เข้า tab HQ → ดูยอด SBR-01
- [ ] **T8.3** **ยอดชิ้น + ยอดเงินของ B = ยอดของ A เป๊ะ** = **บั๊กหายจริง** ✅
- [ ] **T8.4** [A] กดขายเพิ่ม 2 ออเดอร์
- [ ] **T8.5** [B] รอ ≤60 วิ → dashboard update เอง → ยอด **ตรงกัน** อีกครั้ง

**T8.3 กับ T8.5 คือหลักฐานว่าที่แก้มา 8 task มีค่าจริง**

---

## REPORT

ส่งกลับผมในรูปแบบนี้:

```
SETUP: pass
PART 1: T1.1 pass · T1.2 pass · T1.3 pass · T1.4 pass
PART 2: T2.1-4 pass
PART 3: T3.1-6 pass
PART 4: T4.1-5 pass
PART 5: T5.1-3 pass · T5.4 pass
PART 6: T6.1-7 pass
PART 7: T7 SKIP (no legacy keys)
PART 8: T8.3 pass · T8.5 pass ← MOST IMPORTANT
```

**ถ้ามี FAIL แม้ 1 case** — screenshot + คำอธิบายส่งมา ผม audit แล้วเขียน fix

## ทั้งหมดใช้เวลาประมาณ 25-40 นาที (รวมรอ 60 วิสำหรับ polling)
