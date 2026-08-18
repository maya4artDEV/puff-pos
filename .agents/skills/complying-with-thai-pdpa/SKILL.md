---
name: complying-with-thai-pdpa
description: Implement Thailand PDPA (Personal Data Protection Act) compliance in apps and services, especially when handling sensitive data like health, biometric, children's data, or cross-border data transfer. Use this skill when designing data collection flows, building consent UX, implementing right-to-access or right-to-deletion, choosing database regions, or before any deployment that touches user data in the Thai market.
---

# Complying with Thai PDPA

> **Codex reference:** P-28 (PDPA / Data Minimization)
> **Law:** พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (มีผลบังคับใช้เต็ม 1 มิ.ย. 2565)
> **Regulator:** PDPC (สำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล)
> **Penalty:** สูงสุด 5,000,000 บาท/ครั้ง + อาญา (กรณีฝ่าฝืนร้ายแรง)

> **Disclaimer:** Skill นี้สรุปจาก PDPA + PDPC guidelines ปี 2022-2026 — ไม่ใช่คำปรึกษาทางกฎหมาย กรณีซับซ้อนปรึกษาทนาย/DPO ที่ certified

## หลักการ 6 ข้อ (PDPA มาตรา 22-23)

1. **Lawfulness** — มีฐานทางกฎหมายในการใช้ข้อมูล (consent, contract, legal obligation, vital interest, public interest, legitimate interest)
2. **Purpose limitation** — ใช้ตามวัตถุประสงค์ที่แจ้งเท่านั้น
3. **Data minimization** — collect เฉพาะที่จำเป็น
4. **Accuracy** — ต้องถูกต้อง อัพเดท
5. **Storage limitation** — เก็บเท่าที่จำเป็น
6. **Integrity and confidentiality** — security + access control

## Special Categories (มาตรา 26 — ต้อง explicit consent)

ข้อมูลที่ต้องการ consent ที่ **ชัดเจน + แยกออกมา** (ไม่ใช่รวมกับ Terms):

- **Health data** (เช่น Pippa, Da'Neng Care)
- **Biometric** (ลายนิ้วมือ, face ID, voice print)
- **Genetic** data
- **Sexual orientation** / activity
- **Religion** / philosophical belief
- **Political opinion**
- **Criminal record**
- **Race** / ethnic origin
- **Trade union** membership

**Children data:**
- อายุ < 10 ปี → ต้อง parental consent
- 10-20 ปี → consent ของเด็ก + guardian (ถ้ายังไม่บรรลุนิติภาวะ)

## Mandatory Implementation Baseline

### 1. Data Minimization Audit

ทุก field ที่ collect ตอบคำถาม:

```
[ ] จำเป็นสำหรับ feature ที่ user ใช้จริงตอนนี้ไหม?
[ ] ใช้เพื่อวัตถุประสงค์ที่แจ้งใน Privacy Policy ไหม?
[ ] มี alternative ที่ collect น้อยกว่าไหม?
[ ] เก็บนานแค่ไหน? นโยบายการลบ?
```

**ถ้าตอบ "อาจใช้ในอนาคต" → ไม่ collect**

ตัวอย่าง:
- ❌ Collect เบอร์โทร "เผื่อ marketing" → ไม่ได้
- ✅ Collect เบอร์โทร "สำหรับ OTP login" → ได้ + ต้องลบเมื่อ user delete account

### 2. Consent Flow

```
[Modal/Screen: ขอ consent]
   ├── อธิบายชัด: เก็บอะไร / ทำไม / กับใคร
   ├── แยก consent ต่อวัตถุประสงค์ (granular)
   │     [ ] Functional (จำเป็น) — pre-checked, can't uncheck
   │     [ ] Analytics — opt-in
   │     [ ] Marketing — opt-in
   │     [ ] Health data processing — opt-in, แยก checkbox
   ├── Link: Privacy Policy + Terms
   └── ปุ่ม [ยอมรับ] / [ปฏิเสธ]
```

**Anti-patterns ที่ผิด PDPA:**
- ❌ Bundled consent ("ยอมรับทั้งหมดเป็น default")
- ❌ Pre-checked checkbox สำหรับ optional consent
- ❌ Dark pattern (ปุ่ม "ยอมรับ" ใหญ่กว่า "ปฏิเสธ")
- ❌ "เพื่อใช้แอปต้องยอมรับทุกอย่าง"

### 3. Consent Log Schema

ทุก consent ต้องบันทึก (audit trail):

```json
{
  "userId": "u_abc123",
  "consentId": "c_xyz789",
  "policyVersion": "2026.06.01",
  "consentItems": {
    "functional": true,
    "analytics": true,
    "marketing": false,
    "health_processing": true,
    "child_data_parental": true
  },
  "timestamp": 1718888888000,
  "ipAddress": "hashed_sha256",
  "userAgent": "...",
  "method": "explicit_button_click",
  "withdrawnAt": null,
  "withdrawalReason": null
}
```

เก็บใน collection แยก — **ห้ามลบ** (เป็น audit trail) แม้ user ขอ delete account

### 4. Right to Access (มาตรา 30)

User ขอ export data ของตัวเอง → ต้องส่งภายใน **30 วัน**

```
Implementation:
[ ] ปุ่ม "ดาวน์โหลดข้อมูลของฉัน" ใน Settings
[ ] Generate JSON/CSV ของทุก data ที่เกี่ยวกับ user นั้น
[ ] รวม: profile, activity log, consent history, files
[ ] ส่งผ่าน email หรือ in-app download
[ ] Log การ request ในระบบ
```

```js
// ตัวอย่าง endpoint
async function exportUserData(userId) {
  const data = {
    profile: await getProfile(userId),
    activity: await getActivity(userId),
    consents: await getConsents(userId),
    files: await getFileMetadata(userId)
  };
  await logRequest('access', userId);
  return data;
}
```

### 5. Right to Deletion (มาตรา 33)

User ขอลบ → ต้องลบภายใน **30 วัน**

```
Implementation:
[ ] ปุ่ม "ลบบัญชีของฉัน" ใน Settings
[ ] Confirmation 2-step (กัน accidental)
[ ] Soft delete ทันที (mark deleted=true, hide from UI)
[ ] Hard delete ภายใน 30 วัน (cron job ลบจริงจาก DB + backup)
[ ] ส่ง confirmation email
[ ] เก็บ consent log + minimal record สำหรับ audit (legal basis)
```

**ข้อยกเว้นที่เก็บได้** (ต้อง document):
- Legal obligation (เช่น tax record 5 ปี)
- Public interest research (anonymized only)
- Defense of legal claims (เก็บได้แต่ต้อง justify)

### 6. Data Residency

| Region | PDPA Status | ใช้ยังไง |
|---|---|---|
| **Thailand** | ✅ Adequate | Default safe |
| **Singapore** (asia-southeast1) | ✅ Adequate (PDPC interpretation) | ใช้ได้ + disclose ใน policy |
| **EU** (europe-west1) | ✅ Adequate (GDPR similar) | ใช้ได้ + disclose |
| **US** (us-central1) | ⚠️ Not adequate | ต้องมี SCC / Binding Corporate Rules |
| **อื่นๆ** | ⚠️ Case-by-case | ต้อง assessment |

**Pippa/Da'Neng (health data + children):**
- ใช้ Firebase asia-southeast1 (Singapore) = ปลอดภัย
- ถ้าใช้ AI API (Claude/OpenAI/Gemini ที่ host us) สำหรับ health processing → ต้องมี DPA + disclose

### 7. Breach Notification

ถ้าข้อมูลรั่ว:

```
ภายใน 72 ชั่วโมง:
[ ] แจ้ง PDPC ทาง online form
[ ] แจ้ง user ที่ affected (ถ้า risk สูง)
[ ] เปิดเผยใน Privacy Center ของ app
[ ] รวบรวม evidence + remediation plan
```

**สิ่งที่ต้องเตรียมก่อนเกิด:**
- Incident response plan
- DPO contact ที่ active 24/7
- Forensic capability (logs ที่ตรวจสอบได้)
- Communication template

## DPO Requirements

ต้องมี DPO (มาตรา 41) ถ้า:
- เป็น Data Controller ที่ process ข้อมูลจำนวนมาก (regular + systematic monitoring)
- Process Special Category data เป็น core business (เช่น health app)

**Pippa/Da'Neng → ต้องมี DPO** เพราะเป็น health data + children

DPO contact ต้อง:
- มี email สาธารณะ
- ระบุใน Privacy Policy
- ติดต่อได้จริงภายใน reasonable time

## Privacy Policy Template Sections

ต้องครอบคลุม:

```
1. ข้อมูลที่เก็บ (รายละเอียดต่อ category)
2. วัตถุประสงค์การเก็บ + ฐานทางกฎหมาย
3. ระยะเวลาเก็บ
4. ใครเข้าถึงได้ (third party, vendor)
5. ส่งข้อมูลข้ามประเทศ (region + safeguards)
6. สิทธิของ Data Subject (access, deletion, rectification, withdraw consent, portability, object)
7. การติดต่อ DPO
8. การเปลี่ยนแปลง policy (notification process)
9. Cookie policy (web)
10. Children data (ถ้ามี)
```

## Code Patterns

### Consent Check Wrapper

```js
async function withConsent(userId, consentType, fn) {
  const consents = await getConsents(userId);
  if (!consents[consentType]) {
    throw new Error(`Missing consent: ${consentType}`);
  }
  return fn();
}

// Usage
await withConsent(userId, 'analytics', () => {
  trackEvent('feature_used', { feature: 'baby_log' });
});
```

### Data Minimization in API

```js
// ❌ Bad — return everything
app.get('/user/:id', async (req, res) => {
  const user = await db.users.findById(req.params.id);
  res.json(user);  // ส่งทุก field รวม sensitive
});

// ✅ Good — explicit projection
app.get('/user/:id', async (req, res) => {
  const user = await db.users.findById(req.params.id, {
    fields: ['displayName', 'avatar', 'bio']  // เฉพาะที่ public
  });
  res.json(user);
});
```

### PII Logging Filter

```js
// ❌ Never log PII raw
console.log('User created:', { email: user.email, phone: user.phone });

// ✅ Use safe logger
logger.info('User created', {
  userId: user.id,
  email: hash(user.email),  // or mask: u***@example.com
  region: user.region
});
```

## Quarterly Audit Checklist

ทุก 3 เดือน:

```
[ ] Data inventory ยังตรงกับ collect จริง?
[ ] Privacy Policy ยัง up-to-date?
[ ] Consent flow ทำงานครบทุก field ใหม่?
[ ] Right to access ทดสอบ export ได้จริง?
[ ] Right to deletion ทดสอบลบได้จริงครบ backup?
[ ] Data residency ของ vendor ทุกตัวยังตรง?
[ ] Breach response plan ยัง valid (contacts, escalation)?
[ ] DPO contact ยัง active?
[ ] Vendor DPA ทุกตัวยังไม่ expire?
[ ] Staff awareness training (ถ้ามีพนักงาน)?
```

## Anti-patterns ที่ต้องหลีกเลี่ยง

- ❌ Bundled consent
- ❌ Pre-checked optional consent
- ❌ Privacy Policy ที่ copy มาจาก app อื่น
- ❌ Collect "เผื่ออนาคต"
- ❌ Log PII ใน console / file ที่ไม่ secure
- ❌ Share data กับ third party โดยไม่ disclose
- ❌ Cross-border transfer โดยไม่มี safeguard
- ❌ ละเลย consent withdrawal
- ❌ Delay right to access/deletion เกิน 30 วัน

## Common Misconceptions

| Misconception | Reality |
|---|---|
| "PDPA ใช้กับบริษัทใหญ่เท่านั้น" | ผิด — ใช้กับทุก data controller รวม solo |
| "เก็บที่ Firebase = ปลอดภัย" | ผิด — region สำคัญ + ต้องมี DPA |
| "User กด accept Terms = consent ครบ" | ผิด — Special category ต้อง explicit + separate |
| "Anonymized data = ไม่ใช่ PII" | บางครั้งผิด — ถ้า re-identify ได้ ยังเป็น PII |
| "Delete จาก UI = ลบครบ" | ผิด — ต้องลบจาก backup + cache + analytics |

## Resources

- PDPA full text: https://www.ratchakitcha.soc.go.th
- PDPC guidelines: https://www.pdpc.or.th
- TPQI/DEPA DPO certification: ถ้าจะเป็น DPO certified

> สำหรับ project ที่มี health data + children → consult ทนาย PDPA + DPO certified อย่างน้อย 1 ครั้งก่อน production deploy
