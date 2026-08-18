# PuffStick — Code Conventions

> **Scope:** Applies to PuffStick Order, POS, and CRM (web stack)
> **Reference implementation:** `puffstick-order.html` (production-tested)

---

## 1. STACK CONSTRAINTS

### Required
- HTML/JS/CSS (vanilla)
- Single-file architecture preferred
- No build step (no npm, no webpack, no Vite)
- No external frameworks (no React, no Vue, no jQuery)
- WebView compatible (Android low-end, iOS Safari old versions)

### Approved external libraries
- Firebase Web SDK (REST API only — ไม่ใช้ SDK ที่ requires build)
- Google Fonts (CDN preconnect)
- LINE Share URL scheme

### Forbidden
- ❌ React / Vue / Angular / Svelte
- ❌ Build tools (Webpack, Vite, esbuild)
- ❌ TypeScript (ใช้ vanilla JS)
- ❌ CSS frameworks (no Tailwind, no Bootstrap)
- ❌ npm packages

---

## 2. JAVASCRIPT RULES (เด็ดขาด)

### Variable declaration

```js
// ✅ ถูก
var branches = lsGet('branches') || {};
var i, total = 0;
for (i = 0; i < items.length; i++) { /* ... */ }

// ❌ ผิด
const branches = lsGet('branches') || {};
let total = 0;
```

**Why:** WebView เก่าใน Android low-end + iOS เก่า support `var` แน่นอน

### Function definitions

```js
// ✅ ถูก - function declaration
function calculatePrice(qty, hasDiscount) {
  var price = qty * 20;
  if (hasDiscount) price = price * 0.9;
  return price;
}

// ❌ ผิด - arrow ใน render-heavy code
const calculatePrice = (qty, hasDiscount) => qty * (hasDiscount ? 18 : 20);
```

**Why:** Arrow function debug ยาก, stack trace อ่านไม่ออก

### String building (เด็ดขาด)

```js
// ✅ ถูก - string concat
function renderItem(item) {
  var html = '<div class="item">';
  html += '<span class="name">' + item.name + '</span>';
  html += '<span class="qty">' + item.qty + ' ชิ้น</span>';
  html += '</div>';
  return html;
}

// ❌ ผิด - nested template literals (เคย CRASH ใน production!)
function renderItem(item) {
  return `<div class="item">
    ${item.subItems.map(s => `<span>${s.name}</span>`).join('')}
  </div>`;
}
```

**Why:** Nested backticks เคยทำ JS crash ใน Order System — established rule แล้ว

### Top-level declarations

```js
// ✅ ถูก - declare ที่ top of script
var FB_DEFAULT_URL = 'https://...';
var FB_DEFAULT_PATH = 'puffstick';

function fbConfig() {
  return { url: FB_DEFAULT_URL, path: FB_DEFAULT_PATH };
}

// ❌ ผิด - declare หลังถูกใช้ → crash
function fbConfig() {
  return { url: FB_DEFAULT_URL };
}
// ... 800 lines later ...
var FB_DEFAULT_URL = 'https://...'; // ❌ ใช้ก่อนประกาศ
```

**Why:** Order System เคย crash เพราะปัญหานี้ — Tony เสีย token แก้ซ้ำ

---

## 3. DATA LAYER

### localStorage wrapper

```js
function lsGet(k) {
  try { return JSON.parse(localStorage.getItem('ps_' + k)); }
  catch(e) { return null; }
}
function lsSet(k, v) {
  try { localStorage.setItem('ps_' + k, JSON.stringify(v)); }
  catch(e) {}
}
```

### Key prefix convention

| System | Prefix |
|---|---|
| Order | `ps_` (PuffStick) |
| POS | `pos_` |
| CRM | `crm_` |

> หรือถ้า unified codebase → ใช้ `ps_` ทั้งหมด + sub-namespace เช่น `ps_pos_orders`

### Firebase paths

```
puffstick/                    ← Root (ทุก system ใช้ Firebase project เดียวกัน)
├── branches_v2/              ← Order: branches/PIN
├── orders/{id}                ← Order: order records
├── config/                    ← Shared: admin pw, integrations
├── pos/                       ← POS: sales, transactions
│   ├── sales/{id}
│   └── transactions/{id}
└── crm/                       ← CRM: customer data, broadcasts
    ├── customers/{id}
    ├── broadcasts/{id}
    └── loyalty/{id}
```

---

## 4. UI / VISUAL CONVENTIONS

### Brand identity (shared)

- **Primary color:** Deep teal-blue `#2C5871`
- **Font:** Noto Sans Thai (with Poppins fallback for English)
- **Style:** Editorial, minimal, "Sunday Vibes"
- **Feel:** Warm professional — ไม่ tech-cold, ไม่ playful

### Layout

- **Mobile-first** — viewport target 360-480px width
- **9:16 vertical** for landing pages
- **Cards** with subtle shadow, rounded 10-12px
- **Buttons:** Primary `#2C5871` bg / cream text

### CSS variables (use system-wide)

```css
:root {
  --blue-deep: #2C5871;
  --blue-mid: #4A7A92;
  --blue-soft: #A5BAC8;
  --blue-tint: #E8F0F5;
  --gold: #D4953F;
  --tan: #C0AC8E;
  --cream: #F5EBD7;
  --green: #2D7D5F;
  --red: #C73E3A;
  --orange: #E08534;
  --ink: #1A2832;
  --gray-dark: #3D4D5A;
  --gray: #6B7B85;
  --gray-light: #A8B4BC;
  --bg: #FAFBFC;
  --light: #F0F2F5;
  --border: #E4E8EB;
  --white: #FFFFFF;
  --shadow-sm: 0 1px 3px rgba(26,40,50,.06);
  --shadow: 0 4px 16px rgba(26,40,50,.08);
  --shadow-lg: 0 12px 32px rgba(26,40,50,.12);
}
```

---

## 5. PAGES / NAVIGATION PATTERN

### Single Page App with manual page switching

```js
// All pages exist in DOM, .active class shows one
function goPage(pageId) {
  var pages = document.querySelectorAll('.page');
  for (var i = 0; i < pages.length; i++) {
    pages[i].classList.remove('active');
  }
  document.getElementById(pageId).classList.add('active');
}
```

### Page structure

```html
<div id="page-landing" class="page active">...</div>
<div id="page-login" class="page">...</div>
<div id="page-dashboard" class="page">...</div>
```

### Typical page layout

```html
<div id="page-X" class="page">
  <div class="hdr">
    <button class="btn-back" onclick="goPage('page-prev')">←</button>
    <div class="hdr-title">...</div>
    <div class="hdr-sub">...</div>
  </div>
  <div class="content">
    <div class="card">...</div>
  </div>
</div>
```

---

## 6. FIREBASE INTEGRATION (REST API)

### Why REST not SDK
- ไม่ต้อง build step
- ขนาดเล็กกว่า
- รองรับ WebView เก่า

### Endpoint helper

```js
function fbEndpoint(sub) {
  var c = getFbCfg();
  if (!c.url) return null;
  var base = c.url.replace(/\/$/, '') + '/' + c.path + '/' + sub + '.json';
  if (c.secret) base += '?auth=' + c.secret;
  return base;
}
```

### Sync pattern

```js
// Push
function syncToFirebase(item) {
  var ep = fbEndpoint('orders/' + item.id);
  if (!ep) return;
  fetch(ep, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  }).catch(function(){});
}

// Pull on app load
function pullFromFirebase() {
  var ep = fbEndpoint('orders');
  if (!ep) return;
  fetch(ep)
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(data){
      if (!data) return;
      var arr = Object.values(data);
      lsSet('orders', arr);
    })
    .catch(function(){});
}
```

### Last-write-wins for shared data

```js
// Push with timestamp
function pushBranches() {
  var bs = lsGet('branches') || {};
  var ts = Date.now();
  lsSet('branches_ts', ts);
  fetch(fbEndpoint('branches_v2'), {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ _ts: ts, _payload: bs })
  });
}

// Pull only if remote newer
function pullBranches() {
  fetch(fbEndpoint('branches_v2'))
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (!data || !data._ts) return;
      var localTs = lsGet('branches_ts') || 0;
      if (data._ts > localTs) {
        lsSet('branches', data._payload);
        lsSet('branches_ts', data._ts);
      }
    });
}
```

---

## 7. WORKFLOW DISCIPLINE

### Before editing
1. **View ไฟล์ก่อนเสมอ** — `view` tool ก่อน `str_replace`
2. **Don't assume structure** — Tony อาจแก้ไฟล์เองในระหว่างนั้น

### During editing
1. ใช้ `str_replace` ทีละจุด — **ห้าม regenerate ทั้งไฟล์**
2. Diff > 100 lines = approach ผิด, หยุด rethink
3. แก้ทีละบั๊ก ไม่รวม commit

### Before delivering file (mandatory checklist)

```python
# Self-review script - run before sending
- [ ] Brace balance: count('{') == count('}')
- [ ] No bare `return` outside function
- [ ] All required functions present
- [ ] Variables declared before first use
- [ ] No nested template literals
- [ ] Test scenario อย่างน้อย 1 flow ผ่าน
```

### Tony's golden rule
> "ก่อนส่งไฟล์มา review งานตัวเองให้เรียบร้อย ผมเสีย token ไปเฉยๆ"

---

## 8. KNOWN BUG PATTERNS (เคยเจอ ต้องระวัง)

| Bug pattern | Where seen | Prevention |
|---|---|---|
| Nested template literal crash | Order render functions | Use string concat |
| Variable used before declaration | FB_DEFAULT_URL | Declare at top of script |
| Bare `return` outside function | After major edit | Re-check brace balance |
| Function header missing | After str_replace edits | Verify `function X() {` exists |
| `lsSet` direct write break sync | Branches in admin code | Use wrapper: `saveBranches()` |
| `Math.abs()` missing in compare | Negative duplicate detect | Always abs before compare |
| PDF crash on mobile | Direct print() call | Use iframe preview + Print button |

---

## 9. TESTING DISCIPLINE

### Real testing (not Claude artifact)
- Claude artifact preview = sandboxed → fetch/Firebase calls FAIL (warnings normal)
- Real testing = GitHub Pages live URL on actual mobile

### Two-instance debugging
- Claude artifact ≠ GitHub Pages = different localStorage
- Only Firebase syncs across these
- Tony tests both to catch sync issues

### Smoke test before declaring "done"
1. Open live URL on mobile
2. Test happy path (login → main action → submit)
3. Verify Firebase writes (check console.log for sync)
4. Test on second device — confirm sync works

---

## 10. COMMUNICATION

### With Tony

| Setting | How |
|---|---|
| Casual chat | Thai |
| Code/commit/docs | English |
| Bug reports | Tony sends screenshot + symptom |
| Decisions needed | Ask before assuming |
| Feature ideas | Coordinate impact across Order/POS/CRM |

### Honest AI principles

- บอกตรงๆ ถ้าไม่รู้
- ไม่ apologize เกินจำเป็น
- ไม่มักง่าย / satisficing
- Visual proof, not just words

---

## 11. WHEN TO BREAK THESE RULES

These rules are battle-tested but not absolute. Break them when:

- New WebView versions support modern features สมบูรณ์ + Tony approves
- Performance bottleneck requires different approach
- Tony explicitly wants experiment

**Always discuss with Tony first if you want to break a convention.**

---

> **End of Conventions**
> Last updated: 2026-04-30 (post Order System v3.1 production launch)
