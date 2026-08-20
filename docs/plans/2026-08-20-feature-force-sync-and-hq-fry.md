# PLAN: Feature — ☁ force sync + "ทอดวันนี้" บน HQ card

2 sub-tasks. Client-only ก่อน (Sub-task A), แล้วค่อย server (Sub-task B).
Conventions: var/function(){}, el(), no innerHTML concat, no arrow fn, no template literal.
node --check ก่อน commit ทุกครั้ง. Bump build stamp 3 spots ตอน Sub-task A (client เสร็จ). Sub-task B = .gs ไม่ต้อง bump อีก.

---

## Sub-task A — client: ☁ กดได้ + รับ fryPieces จาก server

### A1: ☁ icon กดได้
File: `index.html`

Line 618 (#syncIcon element):
- เปลี่ยน `cursor:default` → `cursor:pointer`
- เปลี่ยน `title="ซิงค์แล้ว"` → `title="กดเพื่อซิงค์ทันที"`
- เพิ่ม `id` ยังคงเป็น `syncIcon` (ไม่เปลี่ยน)

ใน JS — เพิ่ม delegated click handler 1 ครั้งตอน init (ใกล้ DOMContentLoaded ~line 3001):
```js
var si = $("syncIcon");
if (si) si.addEventListener("click", function() {
    if (getDeviceMode() === "viewer") {
        // viewer: force-pull cloud now
        if (typeof refreshHQData === "function") refreshHQData();
        else if (typeof prefetchCloudState === "function") prefetchCloudState(currentBranch);
    } else {
        // writer: flush queue now
        flushSyncQueue();
    }
});
```

ไม่แตะ updateSyncIcon() — มันอัปเดต text/color อยู่แล้ว ใช้ event flush/refresh จบ

### A2: HQ card รับ fryPieces (เตรียมช่อง ยังไม่มีข้อมูล รอ Sub-task B)
File: `index.html`, บรรทัด ~3374-3376 (numBox section)

เพิ่มบรรทัดถัดจาก frozenPieces:
```js
nums.appendChild(numBox("ทอดวันนี้", (s.fryPieces||0) + " ชิ้น", "var(--cocoa)"));
```

`s.fryPieces` จะ undefined จนกว่า Sub-task B จะ deploy → ได้ค่า 0 (safe default ด้วย `||0`)

### A3: bump build stamp + node --check + commit
Build stamp → `20260820.HHMM` (เวลาปัจจุบัน) 3 spots.
Commit: `"feat: ☁ force sync tap + HQ fry count column [build XXXX]"`
หยุดรอ review ก่อน Sub-task B.

---

## Sub-task B — server: เพิ่ม fryPieces ใน state_list

File: `backend/owner/Code.gs` และ `backend/franchise/Code.gs` (identical change)

### B1: เพิ่มตัวแปร fryPieces ในการ loop stock
ใน state_list handler (~line 272-289) — เพิ่ม `fryPieces` ควบคู่กับ `frozenPieces`:

```js
// OLD declaration:
var totalAmount = 0, orderCount = 0, soldPieces = 0, frozenPieces = 0;

// NEW:
var totalAmount = 0, orderCount = 0, soldPieces = 0, frozenPieces = 0, fryPieces = 0;
```

ใน loop (ต่อจาก `frozenPieces += ...`):
```js
fryPieces += (s.fry_out || 0);
```

ใน states.push (ต่อจาก `frozenPieces: frozenPieces`):
```js
fryPieces: fryPieces,
```

### B2: commit แยก
ทำ Owner ก่อน commit, แล้วทำ Franchise commit แยก:
- `"feat(owner): add fryPieces to state_list response"`
- `"feat(franchise): add fryPieces to state_list response"`

ไม่มี node --check สำหรับ .gs แต่ให้ view ผลลัพธ์ diff ก่อน commit ทุกครั้ง.

### B3: redeploy (Tony ทำ)
Tony paste Owner Code.gs → Apps Script Owner → ใส่ TG_BOT_TOKEN จริง → Deploy → Manage deployments → ✏️ → New version.
ทำซ้ำ Franchise.
URLs ต้องไม่เปลี่ยน.

---

## Verify หลัง deploy (Tony ทำ)
1. Writer ทอดรอบนึง → HQ tab → เห็น "ทอดวันนี้: N ชิ้น" บนการ์ดสาขา (ภายใน 60 วิ หรือกด ☁)
2. กด ☁ บน writer → `flushSyncQueue()` รัน → ☁ เปลี่ยนเป็น ⟳ แล้วกลับ ✓ = flush ทำงาน
3. กด ☁ บน viewer → refresh → HQ card อัปเดตทันที ไม่ต้องรอ 60 วิ

## Notes
- viewer ที่ไม่ได้อยู่ที่ HQ tab: กด ☁ จะเรียก `prefetchCloudState(currentBranch)` แทน (pull state branch ปัจจุบัน)
- `fryPieces` = sum ทุก filling ที่ fry_out บนวันนั้น (ไม่ใช่แค่ออริจินัล)
- ถ้า fryPieces = 0 แสดง "0 ชิ้น" (ปกติ = ยังไม่ได้ทอดวันนั้น)
