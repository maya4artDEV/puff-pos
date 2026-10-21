# SPEC — Email Report Direct-Send · puff-pos

> Grounded on **build 0008** · `index.html` MD5 `125a4aeb41ad71ab0fdcac22619ea0bf` (verified) · owner+franchise `.gs` as uploaded 2026-09-19.
> Status: **SPEC — awaiting 2 confirmations** (D3 export type, rollout scope). PLAN + target MD5 after confirm.

---

## 1. Goal / Non-goals

**Goal:** แทน mailto (พังบน in-app browser: user ต้องแนบไฟล์เอง) ด้วย **backend send จริง** — client สร้าง XLSX → base64 → POST → Apps Script `MailApp` ส่งเมล + attach → client ได้ confirmation จริง ("ส่งแล้ว" ไม่ใช่ optimistic).

**Non-goals (MVP):**
- ❌ ไม่เปลี่ยน report content / โครงสร้าง XLSX (reuse `doExport` เดิม)
- ❌ ไม่แตะ close-lock / sync / event types เดิม (`sale`/`fry`/`gift_sale`/`delivery_sale`/`state_save`)
- ❌ ไม่มี HTML summary ใน body (D2 = XLSX only)
- ❌ ไม่ auto-send ตอนปิดวัน (D4 = user กดปุ่มเอง — decouple จาก close)
- ❌ ไม่แตะ `el()`, localStorage key, TG token

---

## 2. Decisions

| # | เรื่อง | ค่า | สถานะ |
|---|---|---|---|
| **D1** | ผู้รับ | `EMAIL_TO` = `92foodlimited@gmail.com` (client ส่งใน payload `to`; backend fallback const เดียวกัน) | ✅ default (reuse const เดิม L3859) |
| **D2** | รูปแบบ | แนบ XLSX อย่างเดียว | ✅ **confirmed by Tony** |
| **D3** | export type ที่ส่ง | `"all"` (workbook เต็ม — ตรงกับ `exportFromState`) | ⏳ **ต้อง confirm** (ทางเลือก: `"close"` = เฉพาะสรุปปิดวัน) |
| **D4** | trigger | repurpose ปุ่ม/ฟังก์ชัน `sendEmail()` เดิม (user กด) | ✅ default |
| **SCOPE** | ทำ backend กี่ตัว | owner-first (stage 1) → franchise (stage 2) | ⏳ **ต้อง confirm** (หรือทำทั้ง 2 รอบเดียว) |

---

## 3. Architecture

```
เดิม:  ปุ่ม Email → sendEmail() → mailto: (user แนบไฟล์เอง) ❌
ใหม่:  ปุ่ม Email → sendEmail() → [load XLSX ถ้ายัง]
         → doExport("all", S, null, deliver)          // deliver = base64 sink (SSOT: build ที่เดียว)
         → fetchJSON(getSheetURL(), {type:"email_report", to, branch, date, filename, xlsxBase64}, 30000)
              → doPost: if type==="email_report" → MailApp.sendEmail(to, subj, body, {attachments:[blob]})
                        → return {ok:true, sent:true}
         → .then: ok → toast "✅ ส่งรายงานเข้าอีเมลแล้ว" | fail → toast error + ปุ่มกดใหม่ได้
```

**หลักการ:**
- **SSOT** — workbook สร้างที่ `doExport` ที่เดียว. เพิ่ม param `deliver` (optional). ไม่มี deliver → download เหมือนเดิม (behavior-identical). มี deliver → base64 → callback. **ไม่ duplicate logic การสร้างชีต.**
- **Readable fetch** — ใช้ `fetchJSON` (build 0008) ไม่ใช่ no-cors → ได้ผลจริงจาก backend.
- **Auto-route** — `getSheetURL()` เลือก owner/franchise จาก `currentBranch` เอง → ไม่ต้อง hardcode URL.
- **Additive** — เพิ่ม `email_report` block ใน `.gs` โดยไม่แตะ handler เดิม; block นี้ `return` เองก่อนถึง `const ss` (MailApp ไม่ต้องเปิด spreadsheet).

---

## 4. Anchors (build 0008 — verified)

### Client `index.html`
| Anchor | Line | ใช้ทำอะไร |
|---|---|---|
| `var EMAIL_TO = "92foodlimited@gmail.com";` | 3859 | reuse (D1) |
| `function getSheetURL()` | 3897 | route target URL |
| `function fetchJSON(url, opts, timeoutMs)` | 4269 | POST helper |
| `function doExport(type, data, dateStr)` | 5809 | **edit: +param `deliver`** |
| `XLSX.writeFile(wb, ... )` tail | ~5902–5905 | **edit: branch base64 vs download** |
| `function sendEmail()` | 5968 | **edit: replace mailto body** |
| build stamp ×3 (meta / title / `#buildVer`) | ~12 / ~13 / ~3502 | bump `20260918.0008` → `20260919.0009` |

### Backend `.gs` (owner + franchise — โครงเหมือนกัน)
| Anchor | ใช้ทำอะไร |
|---|---|
| `if (data.type === "branch_auth") { … }` block | insert `email_report` **หลัง** block นี้ |
| `const ss   = SpreadsheetApp.openById(SHEET_ID);` | insert **ก่อน** บรรทัดนี้ (email_report return ก่อน ไม่เปิด ss) |
| `delivery_sale` base64 pattern (`Utilities.newBlob(Utilities.base64Decode(...))`) | reference — pattern เดียวกัน |

---

## 5. Edits (surgical — total 2 client + 1/script backend)

### C1 — `doExport` signature + tail (SSOT base64 sink)
```js
// signature L5809
function doExport(type, data, dateStr, deliver) {
```
```js
// tail (แทน 2 บรรทัด writeFile+toast เดิม)
var safeDate = (dateStr || todayISO()).replace(/\//g, "-");
var safeLoc = info.locName.replace(/[^a-zA-Z0-9ก-๙]/g, "_");
var fname = "PuffStick_" + safeLoc + "_" + safeDate + "_" + type + ".xlsx";
if (typeof deliver === "function") {
    deliver(XLSX.write(wb, { bookType: "xlsx", type: "base64" }), fname);
    return;
}
XLSX.writeFile(wb, fname);
showToast("📊 Export สำเร็จ");
```
→ callers เดิม (3 args) = download เหมือนเดิม, ไม่ regress.

### C2 — `sendEmail()` replace body (L5968)
```js
function sendEmail() {
    if (!S) return;
    var send = function () {
        doExport("all", S, null, function (b64, fname) {
            showToast("📧 กำลังส่งรายงาน...");
            fetchJSON(getSheetURL(), {
                method: "POST", mode: "cors",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    type: "email_report",
                    to: EMAIL_TO,
                    branch: currentBranch,
                    date: todayISO(),
                    filename: fname,
                    xlsxBase64: b64
                })
            }, 30000).then(function (r) {
                if (r && r.ok) { showToast("✅ ส่งรายงานเข้าอีเมลแล้ว"); }
                else { showToast("❌ ส่งเมลไม่สำเร็จ: " + ((r && r.error) || "unknown"), true); }
            }).catch(function (e) {
                showToast("❌ ส่งเมลไม่สำเร็จ (" + (e && e.message ? e.message : e) + ") ลองใหม่อีกครั้ง", true);
            });
        });
    };
    if (window.XLSX) { send(); return; }
    showToast("กำลังโหลด Excel...");
    loadXLSX(send, function (msg) { showToast(msg, true); });
}
```
→ ปุ่ม `onclick="sendEmail()"` (L3698) **ไม่ต้องแก้**.

### B1 — `.gs` insert `email_report` (ก่อน `const ss`, ทั้ง owner + franchise)
```js
// ── Email daily report (XLSX attachment via MailApp) ──
if (data.type === "email_report") {
  try {
    var b64 = String(data.xlsxBase64 || "");
    if (!b64) throw new Error("no attachment");
    var fname = String(data.filename || ("PuffStick_" + (data.branch || "report") + ".xlsx"));
    var blob = Utilities.newBlob(
      Utilities.base64Decode(b64),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fname
    );
    var to = String(data.to || "92foodlimited@gmail.com");
    var subj = "รายงานยอดขาย PUFF STICK คุณต๋อย สาขา " + (data.branch || "") + " วันที่ " + (data.date || "");
    var body = "เรียนคุณต๋อย\n\nแนบรายงานยอดขายประจำวัน " + (data.date || "") + " สาขา " + (data.branch || "") + "\n(ส่งอัตโนมัติจากระบบ POS)\n";
    MailApp.sendEmail(to, subj, body, { attachments: [blob], name: "PUFF STICK POS" });
    return ContentService.createTextOutput(JSON.stringify({ ok: true, sent: true, to: to })).setMimeType(ContentService.MimeType.JSON);
  } catch (em) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "mail: " + em.message })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

---

## 6. Risks & mitigations

| # | Risk | Mitigation |
|---|---|---|
| R1 | **MailApp scope ยังไม่ authorize** → error ครั้งแรก | Deploy แล้วรัน `doPost` 1 ครั้งใน editor เพื่อกด consent MailApp scope ก่อนใช้จริง |
| R2 | **MailApp "from" = account เจ้าของ script** — franchise script account = ? | Recipient = owner เสมอ (Tony) → correctness ไม่กระทบ. แต่ "from" + quota แยกตาม account → **verify franchise script owner ก่อนทำ stage 2** |
| R3 | MailApp quota (consumer 100/วัน · Workspace 1500/วัน) | ~20–30 สาขา×1 = ไม่ชน. บันทึกไว้ |
| R4 | 2 scripts deploy manual (paste-in-editor) — ห้าม `clasp push`/`git add .` (token hazard) | email_report ไม่แตะ token; deploy paste ตามกติกาเดิม |
| R5 | Base64 XLSX ใน POST body ใหญ่เกิน? | daily summary ไม่กี่ KB → OK (delivery_sale ส่งรูป base64 อยู่แล้ว ใหญ่กว่า) |
| R6 | ปุ่มกดรัว → ส่งซ้ำ | MVP รับได้ (toast "กำลังส่ง"); ถ้าจะกัน = disable ปุ่มระหว่างส่ง (upgrade เล็ก) |

---

## 7. Test plan (Tony — มือถือจริง)

- **T1** สาขา owner (เช่น BPI-05): มีข้อมูลวันนี้ → กด Email → toast "กำลังส่ง" → "✅ ส่งแล้ว" → เช็ค inbox `92foodlimited@gmail.com` มีเมล + ไฟล์ .xlsx เปิดได้ ยอดตรง
- **T2** สาขา franchise (stage 2): route ไป franchise URL → ส่งได้ (ถ้าทำ stage 2)
- **T3** สัญญาณอ่อน / timeout: → toast error + ปุ่มกดใหม่ได้ (ไม่ค้าง spinner)
- **T4** ไม่มี XLSX โหลด (net ตัดตอน CDN): → toast "กำลังโหลด Excel..." → fail message ปกติ
- **T5** regression: ปุ่ม Export 4 แบบ (sales/stock/close/all) ยัง **download ปกติ** (deliver undefined path)

---

## 8. Rollout / rollback

- **Client:** file-swap gated on MD5 (NOVA คำนวณ target MD5 ใน sandbox → PowerShell assert live=baseline → swap → assert live=target). Rollback = swap ไฟล์ backup กลับ.
- **Backend:** paste `email_report` block ใน editor → Deploy new version. Rollback = ลบ block + redeploy (additive → ลบออกได้สะอาด). **ระบุชัดทุกครั้งว่า owner หรือ franchise.**
- **Build stamp:** `0008 → 0009` (client เปลี่ยน) — bump ×3.

---

## 9. ⏳ ต้อง confirm ก่อนทำ PLAN + code

1. **D3** — ส่ง type `"all"` (workbook เต็ม 4–6 ชีต) หรือ `"close"` (เฉพาะสรุปปิดวัน)?
2. **SCOPE** — owner-first ก่อน (แล้ว franchise เป็น fast-follow) หรือทำทั้ง owner+franchise รอบเดียว?
   - ถ้าทำ franchise ด้วย → **ยืนยัน R2:** franchise Apps Script อยู่ภายใต้ Google account ไหน (MailApp "from"/quota)?
