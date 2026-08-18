# PuffStick POS + CRM — Master Brief

> **Status:** POS v9 production-ready (สาขาทดสอบใช้แล้ว) · CRM not started
> **Sources:** Handoff from Claude (other account) + analysis layer
> **Last updated:** 2026-04-30

---

## 1. PROJECT IDENTITY

### What this Project covers
- **POS app:** "PUFF STICK คุณต๋อย — Daily POS" (single HTML file, v9, ~252KB)
- **CRM app:** TBD — ยังไม่ได้เริ่ม session นี้

### Relation to Order System (separate Project)
- Order System = B2B แฟรนไชส์สั่งล็อตจาก HQ (production live)
- **POS = พนักงานหน้าร้านบันทึกยอดขายรายวัน** (B2C-side reconciliation)
- **CRM = จัดการสาขา + marketing automation** (HQ admin tool)

### Key insight: POS ≠ Traditional POS
**POS ตัวนี้คือ "Daily Sales Summary + Cashier Reconciliation Tool"** ไม่ใช่ realtime transaction system แบบทั่วไป

Flow หลัก:
```
1. พนักงานเลือกสาขา + กรอก ชื่อ/ชื่อเล่น/เบอร์
2. รับสต๊อกแช่แข็งเข้า (แพ็ค + ชิ้นเศษ)
3. บันทึกรอบทอด (timer 4 stage) → ตัดสต๊อกแช่แข็ง → เพิ่มยอดพร้อมขาย
4. บันทึกออเดอร์ขาย (ลดยอดพร้อมขาย)
5. บันทึกขนมเสีย / แถมฟรี / ของฝาก
6. ปิดวัน: นับเหลือหน้าตู้ + reconcile เงิน (สด+โอน-ทอน-จ่ายออก)
7. Export Excel → Email (mailto) + sync Google Sheets อัตโนมัติ
8. Telegram แจ้ง HQ ทุก event
```

---

## 2. TARGET USERS

### POS users
- **พนักงานหน้าร้าน** ของแต่ละสาขา — ใช้บนมือถือส่วนตัว/ร้าน
- ไม่มี login system — ใช้ branch code เป็น key แทน
- หลายคนต่อสาขาได้ แต่ data localStorage แยกตามเครื่อง (cross-device sync = TBD)

### POS observers
- **Tony (เจ้าของ)** — เห็น realtime ผ่าน Google Sheets + Telegram

### CRM users (planned)
- Tony (HQ admin)
- TBD: HQ staff อื่นๆ?

---

## 3. CURRENT STATE

### POS — v9 production-ready

| Feature | Status |
|---|---|
| เลือกสาขา (preset + พิมพ์เอง franchise/event) | ✅ |
| กรอกข้อมูลพนักงาน (บังคับก่อนบันทึก) | ✅ |
| ตั้งราคาต่อชิ้น (ปรับได้) | ✅ |
| บันทึกออเดอร์ขาย 11 ไส้ | ✅ |
| บันทึกรอบทอด + timer 4 stage | ✅ |
| สต๊อกแช่แข็ง (แพ็ค + ชิ้นเศษ) | ✅ |
| Stock correction + audit log | ✅ |
| Stock carry-over ข้ามวัน | ✅ |
| ขนมเสีย / แถมฟรี | ✅ |
| Withdrawal (เงินจ่ายออก) | ✅ |
| Reconcile เงิน (สด+โอน-ทอน) | ✅ |
| นับเหลือหน้าตู้ | ✅ |
| ของฝาก (gift items) per-branch | ✅ |
| Export Excel 4 แบบ | ✅ |
| Email mailto + แนบไฟล์ | ✅ |
| Sync Google Sheets (sale/fry/gift_sale) | ✅ |
| Telegram notifications | ✅ |
| History tab (read-only) | ✅ |
| Routing Owner / Franchise | ✅ |

### POS — Pending / Tech Debt
- ⏳ Cross-device history — ปัจจุบัน localStorage เครื่องเดียว (no `doGet`)
- ⏳ Franchise TG_CHAT_ID — ยังไม่ได้ตั้ง
- ⏳ GitHub Pages deploy — ยังส่งไฟล์ผ่าน LINE
- ⏳ No offline queue / retry logic
- ⏳ Franchise Apps Script ยังไม่มี `gift_sale` handler

### CRM — Not Started
- ❌ ไม่มี code, ไม่มี wireframe
- ❌ Scope ยังไม่ตัดสินใจ
- Reference: Tony บอกว่า CRM = "จัดการสาขา + marketing automation (LINE/SMS broadcast)"

---

## 4. TECH STACK

### POS

```
Frontend:  Vanilla HTML/JS (single file ~252KB, no build)
CSS:       Vanilla CSS variables
Backend:   Google Apps Script (doPost Web App)
Database:  Google Sheets (2 separate spreadsheets — Owner + Franchise)
Auth:      None (URL = secret, no-cors POST)
Hosting:   ส่งไฟล์ผ่าน LINE (GitHub Pages = TBD)
External:  XLSX.js CDN, Noto Sans Thai (Google Fonts)
```

### Key architectural choices

| Choice | Why |
|---|---|
| Single HTML file | ไม่ต้อง install, เปิด mobile browser, ส่ง LINE ได้ทันที |
| Apps Script + Sheets | ไม่ต้อง infra, ใช้ Google account ที่มีอยู่, deploy ง่าย |
| localStorage = source of truth | offline-first, ไม่ต้อง auth, ทำงานแม้ net ล้ม |
| 2 Sheets แยก (Owner/Franchise) | Tony ไม่ต้องการเห็นยอด franchise ใน sheet ตัวเอง |
| Routing by BRANCH_CODES + E prefix | ไม่บังคับ format รหัส franchise |

### CRM (planned)
- จะ match กับ POS stack (vanilla HTML/JS) — ยังไม่ตัดสิน

---

## 5. CREDENTIALS & SECRETS

> ⚠️ Sensitive — เก็บใน vault ส่วนตัว

| Item | Value |
|---|---|
| **Owner Apps Script URL** | `https://script.google.com/macros/s/AKfycbxMbd0YD2KpUjk0DMYsLdVxGEj1BeCJchv12QmKdN454kMF5BCsIpnsipoTaAWQMOoD/exec` |
| **Franchise Apps Script URL** | `https://script.google.com/macros/s/AKfycbzeHh3ouj782znH-gQemvoH733fQjrQZPWFiesTZU3Hzum4coiEWb2ZAwoC1kPPFM-NDQ/exec` |
| Owner Spreadsheet ID | `1xvDAq2scrnd9H1XcQCeZoATcT_5EMftjWt94XPzz__w` |
| Franchise Spreadsheet ID | `1f6v9eLTGVl8bMxFMWNetppcIpWsPKAPXr6UekzmO-ms` |
| **Telegram Bot Token** | `8704590750:AAEjk7CcuxZxiKSm-MHdLv1QyBJ0nzEwGfQ` |
| Telegram Chat ID (Owner) | `5566010745` |
| Telegram Chat ID (Franchise) | TBD (ยังไม่ตั้ง) |
| Owner Email | `92foodlimited@gmail.com` |
| GitHub repo (POS) | TBD |
| LINE OA Token (CRM) | TBD |

> ⚠️ **Note:** POS Telegram Bot (`8704590750`) ≠ Order System Telegram Bot (`8751318167`) — คนละ Bot

---

## 6. CODE CONVENTIONS (เด็ดขาด — ต่างจาก Order)

### JavaScript rules

✅ **DO:**
- `var` only (ไม่ใช้ `let`/`const`)
- `function(){}` (ไม่ใช้ arrow functions)
- **`createElement` pattern ผ่าน `el()` helper** (ไม่ใช้ innerHTML concat!)
- IIFE สำหรับ closure ใน loops: `(function(id){...})(id)`
- localStorage prefix: `puff7_`

❌ **DON'T:**
- `innerHTML` concat ที่มี quotes ซ้อน (root cause ของ bugs v1-v6)
- Python-style escaping (`\'`) ใน HTML attributes
- Single quote ใน inline `style="..."` (e.g., `style="font-family:'Noto Sans Thai'"`)
- Adjacent string literals (`'a' 'b'` without operator)
- `var location` (ชนกับ `window.location`) — ใช้ `locName` แทน
- `oninput` ที่ trigger full re-render (cursor หาย)

### Critical helper: `el()` (ใช้ตลอดทั้ง app)

```js
// ห้ามแก้ ห้ามทำเองใหม่ — ใช้ตัวนี้
function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function(k) {
        if (k === "cls") { e.className = attrs[k]; }
        else if (k === "txt") { e.textContent = attrs[k]; }
        else if (k === "html") { e.innerHTML = attrs[k]; }
        else if (k === "css") { e.style.cssText = attrs[k]; }
        else { e.setAttribute(k, attrs[k]); }
    });
    if (kids) {
        [].concat(kids).forEach(function(c) {
            if (!c && c !== 0) return;
            if (c instanceof Node) { e.appendChild(c); }
            else { e.appendChild(document.createTextNode(String(c))); }
        });
    }
    return e;
}
function clr(node) { while (node.firstChild) node.removeChild(node.firstChild); }
function $(id) { return document.getElementById(id); }
```

### Naming conventions

| Item | Pattern | Example |
|---|---|---|
| File | `puff-v{N}.html` | `puff-v9.html` |
| Filling ID | 3 chars uppercase | `ORI`, `SEA`, `BNN` |
| Product code | `FG-{ID}` | `FG-ORI` |
| Branch code | `XXX-NN` | `SBR-01`, `TBK-02` |
| Franchise branch | ไม่ตรง preset, ไม่ขึ้น `E` | `RAMA-9`, `BKK-CHATU` |
| Event branch | ขึ้นต้น `E` (capital) | `EXPO-2026` |
| Gift item ID | `"g" + Date.now()` | `g1739123456789` |
| localStorage key | `puff7_{safeBranch}_{dateStr}` | `puff7_SBR-01_18/04/2568` |

### Validation discipline (Tony's golden rule)
> **"ทุก JS ต้องผ่าน `node --check` ก่อน present ทุกครั้ง"**

```bash
# ก่อน present ไฟล์ใหม่ — ดึง JS ออกมา validate
node --check extracted-script.js
```

---

## 7. UI / UX

### Visual identity (different from Order)

```css
/* Brand colors */
--red:           #E8192C    /* primary */
--red-dark:      #C0001E
--blue:          #0072BC    /* primary */
--blue-dark:     #005A96
--bg:            #F5F0EB    /* warm cream */
--card:          #FFFFFF
--ok-green:      #34C759
--warn-orange:   #FF9500
--bad-red:       #FF3B30
--fry-purple:    #AF52DE
--accent-yellow: #FFD60A    /* active tab */
```

### Typography
- Noto Sans Thai (Google Fonts), weights 400/500/600/700/800

### Header
- base64 inline image (`HeadLazada_Mobile-02.jpg`)

### Layout
- Mobile-first (`width=device-width`, no user-scale)
- Sticky header + tab bar
- Fixed bottom action bar
- Modal bottom sheet (timer, gift form)
- ❌ No dark mode

### 5 tabs
1. 🛒 ขาย — บันทึกออเดอร์ + ของฝาก
2. 🔥 ทอด — รอบทอด + timer
3. 📦 สต๊อก — รับ + แก้ไข + summary
4. 📊 ปิดวัน — Export + reconcile
5. 📋 ย้อนหลัง — history (read-only)

> **Style note:** Visual style POS = bold colors (red/blue/yellow) — **ต่างจาก Order's editorial blue** เพราะ POS เน้น speed + clarity ในร้าน, Order เน้น calmness สำหรับ admin

---

## 8. DATA MODEL

### Filling list (11 items)

```js
var F = [
    {id:"ORI", code:"FG-ORI", e:"🥐", n:"ออริจินัล"},
    {id:"SEA", code:"FG-SEA", e:"🌿", n:"ยำสาหร่าย"},
    {id:"BNN", code:"FG-BNN", e:"🍌", n:"กล้วยอัลมอนด์สไลด์"},
    {id:"CRN", code:"FG-CRN", e:"🌽", n:"ข้าวโพด"},
    {id:"PAP", code:"FG-PAP", e:"🍍", n:"สับปะรด"},
    {id:"CKC", code:"FG-CKC", e:"🔥", n:"ไก่หยองพริกเผา"},
    {id:"CKH", code:"FG-CKH", e:"🌶️", n:"ไก่สไปซ์ซี่"},
    {id:"SNC", code:"FG-SNC", e:"🦀", n:"ก้ามปูหิมะเทียม"},
    {id:"HTN", code:"FG-HTN", e:"🐟", n:"แฮมทูน่ามันบด"},
    {id:"CUC", code:"FG-CUC", e:"🍛", n:"ไก่ผัดผงกะหรี่"},
    {id:"CHO", code:"FG-CHO", e:"🍫", n:"ช็อคโกแลต"},
];
```

> ⚠️ **Schema mismatch with Order!**
> - Order uses: `orig`, `ysea`, `banana`, `corn`, `pine`, `croast`, `cspicy`, `krab`, `htuna`, `ccurry`, `choc` (lowercase, 4-6 chars)
> - POS uses: `ORI`, `SEA`, `BNN`, `CRN`, `PAP`, `CKC`, `CKH`, `SNC`, `HTN`, `CUC`, `CHO` (uppercase, 3 chars)
> - Naming ก็ต่างกัน เช่น "ปูอัดอลาสก้า" (Order) vs "ก้ามปูหิมะเทียม" (POS)
> - **ต้องตัดสินใจเรื่องการ unify หรือ map ระหว่าง 2 systems**

### Branch codes

```js
var BRANCH_CODES = [
    { code: "SBR-01", label: "สระบุรี (สาขาหลัก)" },
    { code: "TBK-02", label: "ปตท.ทับกวาง" },
    { code: "MVK-03", label: "สาขามวกเหล็ก" },
    { code: "WNY-04", label: "ปตท.บ้านใหญ่วังน้อย" },
    { code: "BPI-05", label: "ปตท.บางปะอิน" },
];
// Franchise: ไม่อยู่ใน BRANCH_CODES + ไม่ขึ้น E
// Event: ขึ้นต้น E (capital)
```

> ⚠️ **Schema mismatch:** Order มี 20 สาขา (`b01`-`b20`), POS มี 5 สาขา (`SBR-01` etc.) — สาขาเดียวกันแต่รหัสต่างกัน

### State object (per branch per day)

```js
{
  branch: "SBR-01",
  date: "18/04/2568",
  stock: { "ORI": { received_pieces, fry_out, sold }, ... },
  stock_log: [/* audit trail — ไม่ลบ */],
  sales: [/* sale events */],
  fry_log: [/* fry events */],
  withdrawals: [/* cash out */],
  damaged: { "ORI": 2 },
  free_items: { "SEA": 1 },
  pricePerPiece: 10,
  lastStaff: { name, nick, phone },
  gift_catalog: [/* per-branch gifts */],
  gift_stock: { "g1234": { received, sold } },
  gift_sales: [/* gift sale events */]
}
```

### Routing logic

```js
function getSheetURL() {
    var isPreset = BRANCH_CODES.some(function(b) {
        return b.code === currentBranch;
    });
    var isEvent = currentBranch.charAt(0) === "E";
    return (isPreset || isEvent) ? OWNER_URL : FRANCHISE_URL;
}
```

### Apps Script event types
- `sale` → Sales sheet + Telegram
- `fry` → Fry sheet + Telegram
- `gift_sale` → GiftSales sheet + Telegram

> ⚠️ Franchise script ไม่มี `gift_sale` handler — ตอนนี้ของฝากใน franchise ไม่ sync

### Carry-over logic
- ขึ้นวันใหม่ → `loadBranch` ไม่พบ key วันนี้ → `newStateWithCarryOver()`
- ยกของจากวันก่อน:
  1. Stock แช่แข็งเหลือ = `received_pieces - fry_out`
  2. `pricePerPiece`
  3. `gift_catalog` ทั้งหมด
  4. Gift stock เหลือ = `received - sold`

---

## 9. KNOWN ISSUES / BUGS

### Resolved (เก็บไว้เป็นบทเรียน)

| Version | Bug | Root Cause | Fix |
|---|---|---|---|
| v1-v6 | `SyntaxError: Unexpected string` | Python escaping (`\'`) | Raw heredoc JS |
| v6 | All functions broken (`go is not defined`) | `onclick="chg(''+f.id+'',-1)"` adjacent strings | `createElement` + assigned listeners |
| v6 | Single quote in inline style | HTML parser conflict | CSS class instead |
| v7 | Cursor jumps in withdrawal input | `oninput` re-renders entire list | Separate `updWithdrawSum()` |

### Open (v9)
- ✅ ไม่มี bug ที่รู้จัก

### Tech debt
- Franchise Apps Script: `TG_CHAT_ID = "วางตรงนี้"` (placeholder)
- Franchise script ไม่มี `gift_sale` handler
- No offline queue
- Cross-device history TBD

---

## 10. KEY DECISIONS & RATIONALE

### Architectural

| Decision | Rationale |
|---|---|
| Single HTML file | ไม่ต้อง install, ส่งผ่าน LINE ได้ |
| Apps Script + Sheets | ไม่ต้อง infra, ใช้ Google account |
| localStorage source of truth | Offline-first, no auth needed |
| Key = branch + date | Data แยกสนิท + ดูย้อนหลังได้ |
| 2 Sheets แยก | Tony ไม่ต้องการเห็นยอด franchise |
| `createElement` ทุกที่ | แก้ quote escaping ปัญหาทั้งหมด |
| Carry-over อัตโนมัติ | พนักงานไม่ต้องกรอกใหม่ทุกวัน |

### Product

| Decision | Rationale |
|---|---|
| Adjustable price per piece | แต่ละสาขา/event ราคาต่าง |
| Stock correction audit log บังคับ | ป้องกันทุจริต |
| Withdrawal tracking | แยก "เงินขาดเพราะจ่ายออก" จาก "ขาดจริง" |
| Stock = pack + pieces | หน้างานจริงมีซองไม่ครบ 10 |
| Gift items per-branch | แต่ละสาขามีของฝากต่าง |

### Rejected
- ❌ N8N (ยุ่งยาก infra)
- ❌ Firebase สำหรับ POS (Apps Script เพียงพอ)
- ❌ FRN- prefix routing (ใช้ whitelist ดีกว่า)
- ❌ Template literal / innerHTML concat (quote hell)

---

## 11. OPEN QUESTIONS (ต้องตัดสินใจก่อนเดิน)

### Cross-system schema
- [ ] **Filling IDs unify หรือ map?** Order (`orig`) vs POS (`ORI`) — ตัดสินใจอันไหนเป็น canonical?
- [ ] **Branch codes unify หรือ map?** Order (`b01`-`b20`) vs POS (`SBR-01` etc.)
- [ ] **Branch list shared schema?** หรือสองระบบมีของตัวเอง?

### POS pending decisions
- [ ] Cross-device history — ทำ `doGet` ใน Apps Script ไหม?
- [ ] Franchise TG_CHAT_ID — ใช้ Chat เดียว (5566010745) หรือแยก group?
- [ ] GitHub Pages deploy — ทำเมื่อไหร่? URL?
- [ ] Offline queue — retry on network fail?
- [ ] Add `gift_sale` handler ใน Franchise script ด้วยไหม?

### CRM scope
- [ ] เริ่ม build เมื่อไหร่?
- [ ] รวม file เดียวกับ POS หรือแยก?
- [ ] LINE OA channel มีแล้วหรือต้อง setup?
- [ ] Customer database — collect PII (เบอร์, ชื่อ) ไหม? PDPA implications?
- [ ] Loyalty system — point-based? coupon-based?

### Auth
- [ ] พนักงาน POS ต้อง login ไหม? (ตอนนี้ใช้ branch code เป็น key)
- [ ] CRM admin auth strategy?

### Payment
- [ ] เพิ่ม credit card / KBank QR / PromptPay payment gateway?

---

## 12. CONVERSATION HIGHLIGHTS

### Major milestones
- **v1-v5:** POS basic (sales, fry, stock, close-day) + Sheets sync
- **v6:** ⚡ JS syntax fix breakthrough — switched to `createElement`
- **v7:** Branch routing (Owner/Franchise), gifts, audit log, carry-over, history, withdrawal fix
- **v8:** ✨ Tony uploaded own version — better routing logic, BRANCH_CODES whitelist
- **v9:** Stock carry-over ข้ามวัน + gift items full implementation + Apps Script `gift_sale` handler

### Pivots
- N8N → Google Apps Script (ง่ายกว่า)
- FRN- prefix → BRANCH_CODES whitelist (Tony's version is better)
- innerHTML concat → createElement (eliminate quote bugs)

### Breakthroughs
- 💡 Discovery: `'a' 'b'` adjacent literals = JS crash
- 💡 `node --check` validation pre-delivery
- 💡 Tony's v8 routing > AI's v7 routing → adopted

### Tony's feedback patterns
- ✅ ชอบ: ตรงจุด, ไม่อธิบายยืดยาว, validate ก่อน deliver
- ❌ ไม่ชอบ: error ซ้ำ, แก้หลายรอบ, ย่อ/ตัดเนื้อหา
- 🔥 กฎเหล็ก: `node --check` ก่อน present, ห้าม innerHTML concat

---

## 13. ROADMAP

### Immediate (this week)
- [ ] ทดสอบ v9 ในสาขาจริง — ยืนยัน carry-over + gifts ทำงานถูก
- [ ] ตั้งค่า Franchise TG_CHAT_ID
- [ ] Decide: GitHub Pages deploy?

### Short-term (1 month)
- [ ] Cross-device history (`doGet` in Apps Script)
- [ ] Franchise `gift_sale` handler
- [ ] Begin CRM scoping conversation

### Long-term (3+ months)
- [ ] CRM build — branch management + LINE broadcast
- [ ] Customer database (PDPA-compliant)
- [ ] Coordinate schema กับ Order System (filling IDs / branch IDs)
- [ ] Payment gateway integration (if needed)

---

## 14. FILES & ARTIFACTS

| File | Type | Purpose |
|---|---|---|
| `puff-v9.html` | HTML/JS/CSS (252KB) | Latest POS — canonical |
| `puff-v8.html` | HTML/JS/CSS | Tony's base version |
| `Code.gs` (Owner) | Apps Script | Owner sheet handler — sale/fry/gift_sale + Telegram |
| `Code.gs` (Franchise) | Apps Script | Franchise handler — sale/fry only (no gift_sale, TG_CHAT_ID TBD) |
| `HeadLazada_Mobile-02.jpg` | Image | Header banner (base64 inline in HTML) |

---

## 15. CRITICAL HANDOFF NOTES TO CLAUDE (อ่านก่อนทำงาน)

### 🚨 First-day priorities

1. **POS = Daily Sales Summary, NOT realtime POS** — อย่าเสนอ feature แบบ traditional POS
2. **CRM ยังไม่มีอะไรเลย** — ต้องเริ่มจาก scope discussion
3. **2 Telegram bots ต่าง** — POS ใช้ `8704590750`, Order ใช้ `8751318167`
4. **2 Apps Scripts ต่าง URL** — Owner vs Franchise
5. **Schema ไม่ sync กับ Order System** — filling IDs + branch IDs ใช้คนละ format
6. **CSS/JS conventions ต่างจาก Order** — POS ใช้ `createElement`, Order ใช้ string concat

### 🔥 Tony's working style (สำคัญ)

- **ภาษา:** ไทย (chat) / English (code, docs)
- **Validate before deliver** — `node --check` ทุกครั้ง, ห้ามข้าม
- **Visual proof required** — ไม่เชื่อแค่คำพูด
- **No satisficing** — ห้ามมักง่าย
- **Token-conscious** — surgical edits, ไม่ regenerate
- **No verbose explanations** — ตรงจุด

### ❌ Hard rules (เด็ดขาด)

- ❌ ห้าม `innerHTML` concat ที่มี quotes ซ้อน
- ❌ ห้าม template literals (`` ` ``) ใน DOM strings
- ❌ ห้าม arrow functions
- ❌ ห้ามใช้ `let`/`const` (ใช้ `var` เท่านั้น)
- ❌ ห้ามแก้ `el()` helper
- ❌ ห้ามเปลี่ยน localStorage key format (`puff7_{branch}_{date}`)
- ❌ ห้ามใช้ Firebase ใน POS (POS = Apps Script + Sheets only)
- ❌ ห้ามแก้ Apps Script `doPost` event types โดยไม่ปรึกษา

### ✅ When to coordinate with Order System Project

- Schema changes (branch IDs / filling IDs)
- Product list updates
- Branch list updates
- Customer data (when CRM begins)

### When in Doubt → Ask Tony first

- Schema unification with Order
- Adding new Apps Script event types
- Changing localStorage structure
- Build CRM features (since CRM scope is still TBD)

---

## 16. ANYTHING ELSE

### Why POS visual is bold (vs Order's calm editorial)
- POS used in fast-paced retail context — needs high-contrast, immediate feedback
- Order used by admins reviewing data — calm, considered
- Don't try to unify visual style — they serve different contexts

### Key wisdom from POS development
> "innerHTML string concat with nested quotes = JS hell. createElement = sanity."

This rule is **non-negotiable** for POS. If we ever unify codebases with Order (which uses string concat), we need to migrate Order to createElement, not the other way.

---

> **End of POS + CRM Master Brief**
>
> 📍 **First task for new Claude:**
> 1. Confirm understanding of POS vs CRM scope
> 2. Help decide: schema unification with Order System (urgent decision)
> 3. Begin CRM scoping discussion when Tony is ready
