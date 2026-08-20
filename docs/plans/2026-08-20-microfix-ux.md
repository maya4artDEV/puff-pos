# PLAN: Micro-fix batch — 3 UX issues

1 commit รวด ไม่มี sub-task แยก เพราะทั้ง 3 เล็กและไม่ conflict กัน.
node --check + bump build + commit + push. หยุดรอ review.

---

## Fix 1 — ลบ label "1 แพ็ค = 10 ชิ้น" (line 690)

เปลี่ยน:
```html
<div class="card-title">รับสต๊อกเข้า <span style="font-size:10px;font-weight:500;color:var(--muted)">1 แพ็ค = 10 ชิ้น</span></div>
```
เป็น:
```html
<div class="card-title">รับสต๊อกเข้า</div>
```

---

## Fix 2 — input ที่ควร placeholder แทน value="0"

**เป้าหมาย:** เมื่อกดช่องกรอก ไม่ต้องลบ 0 ก่อน — ตัวเลข 0 จาง (placeholder) ไม่ใช่ค่าจริง

**Fields ที่ต้องแก้** (value="0" → value="" + placeholder="0"):
- `dlvGross` (line ~1546): delivery gross
- `dlvNet` (line ~1550): delivery net
- `fr-{f.id}` (line ~2048): จำนวนทอดแต่ละไส้
- `rpi-{f.id}` (line ~2201): จำนวนรับสต๊อก
- `cpi-{f.id}` (line ~2263): ปรับปรุงสต๊อก
- `gr-{g.id}` (line ~2938): รับสต๊อกของฝาก

**ห้ามแก้:**
- `withdrawTotal` (line 767) — readonly แสดงผล ไม่ใช่ input กรอก
- บรรทัด 2948 — `inp.value = 0` หลัง save = reset field หลังบันทึก ถูกต้องแล้ว

**Pattern แก้:** เปลี่ยน `value:"0"` → `value:""` ใน el() call ของแต่ละ field
(placeholder:"0" มีอยู่แล้วในบางตัว ตัวที่ไม่มีให้เพิ่ม)

**Logic ที่ใช้ค่า input — ตรวจแล้วไม่กระทบ:**
code ทุกจุดใช้ `parseInt(inp.value) || 0` อยู่แล้ว:
- value="" → parseInt("") = NaN → || 0 = 0 ✓ ปลอดภัย
- กรอก "5" → parseInt("5") = 5 ✓

---

## Fix 3 — ☁ icon พื้นที่กดใหญ่ขึ้น + visual feedback

line 618 — เพิ่ม padding รอบ icon:
```html
<!-- OLD -->
<div id="syncIcon" style="font-size:11px;color:#6B9E4B;padding:0 0 4px;cursor:pointer;font-family:var(--fn)" title="กดเพื่อซิงค์ทันที">☁✓</div>

<!-- NEW: padding ใหญ่ขึ้น + font-size ขึ้นนิด + border-radius กัน misclick -->
<div id="syncIcon" style="font-size:13px;color:#6B9E4B;padding:6px 10px;cursor:pointer;font-family:var(--fn);border-radius:8px;margin-bottom:2px" title="กดเพื่อซิงค์ทันที">☁✓</div>
```

เพิ่ม visual feedback ใน click handler (line ~3011) — flash background เมื่อกด:
```js
// เพิ่มใน event listener หลัง if/else block (ก่อน close }):
var el_si = $("syncIcon");
if (el_si) {
    el_si.style.background = "rgba(107,158,75,.15)";
    setTimeout(function() { el_si.style.background = ""; }, 300);
}
```

---

## Gate
- node --check PASS
- brace balance ตรง
- Build stamp → `20260820.HHMM` (bump จาก 1756)
- commit: `"fix: remove แพ็ค label, input placeholder=0, ☁ larger tap area [build XXXX]"`
- push origin main
- หยุดรอ review
