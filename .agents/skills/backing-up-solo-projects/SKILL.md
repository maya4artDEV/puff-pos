---
name: backing-up-solo-projects
description: Establish and maintain backup discipline for solo builders who lack team infrastructure or company backup systems. Use this skill when starting a new project, after any significant deploy, when setting up a new device, when rotating credentials, or when planning disaster recovery. Covers code repos, databases, credentials, signing keys, and vendor lock-in risks.
---

# Backing Up Solo Projects

> **Codex reference:** P-24 (Backup Discipline)
> **When to load:** เริ่ม project ใหม่, หลัง deploy สำคัญ, setup เครื่องใหม่, rotate credential, plan DR

## หลักการ

Solo builder = **single point of failure by default**

ไม่มี company backup, ไม่มี IT team, ไม่มี ops, ไม่มีคน peer review
- เครื่อง SSD พัง → ทุก project หายพร้อมกัน
- GitHub/Cloud account ถูก ban → ทุก project ที่ผูกกับ account นั้น lock
- Domain registrar ปิด → ลูกค้าเข้าไม่ได้
- ลืม 2FA backup code → recovery ไม่ได้

**Backup ไม่ใช่ optional — มันคือ "งาน" ของ solo builder**

## 3-2-1 Rule (Mandatory)

| ตัวเลข | ความหมาย | ตัวอย่าง |
|---|---|---|
| **3** copies | ของทุก project critical | Local + Git remote + offline backup |
| **2** different media | สื่อต่างกัน | SSD เครื่องตัวเอง + cloud Git |
| **1** off-site | คนละสถานที่/region | External drive ที่บ้านพ่อแม่ + cloud อีก region |

## Weekly Ritual (ทุกศุกร์เย็น 30 นาที)

### Step 1: Code Repo

```bash
# วน loop ทุก project repo
cd ~/projects
for dir in */; do
  cd "$dir"
  echo "=== $dir ==="

  # ตรวจ uncommitted changes
  git status --porcelain | wc -l   # ต้องเป็น 0

  # ตรวจ unpushed commits
  git log @{u}.. --oneline 2>/dev/null

  cd ..
done
```

**กฎ:** ทุก repo ต้อง clean + pushed ภายในศุกร์เย็น

### Step 2: Database Snapshot

```bash
# Firebase Realtime Database
firebase database:get / --project YOUR_PROJECT > backups/fb-$(date +%Y%m%d).json

# Firestore
gcloud firestore export gs://YOUR_BUCKET/backup-$(date +%Y%m%d)

# Postgres
pg_dump dbname > backups/pg-$(date +%Y%m%d).sql

# MySQL
mysqldump dbname > backups/mysql-$(date +%Y%m%d).sql
```

**เก็บ:** อย่างน้อย 4 weekly snapshots + 12 monthly

### Step 3: External Drive Sync

```bash
# rsync ไป external SSD
rsync -av --delete ~/projects/ /Volumes/Backup/projects/
rsync -av --delete ~/backups/ /Volumes/Backup/backups/

# Or use Time Machine / Windows File History
```

### Step 4: Verify Restore-ability (Quarterly)

ทุก 3 เดือน — **ทดสอบ restore จริง 1 project**

```
1. เปิด backup folder (ไม่ใช่ live folder)
2. clone repo จาก backup
3. restore DB จาก snapshot
4. ลอง run end-to-end
5. ถ้าใช้ไม่ได้ → backup เสีย → fix process ทันที
```

**สิ่งที่มักพังตอน restore:**
- Environment variables หาย → จด `.env.example`
- API keys revoked → ต้อง rotate ตอน restore
- Database migration history หาย → keep migration files in repo

## Credential Backup

### 2FA Backup Codes

ทุก service ที่เปิด 2FA → **เก็บ backup code 3 ที่:**

1. Password manager (1Password, Bitwarden) — primary
2. Print หรือเขียนใส่กระดาษ → ใส่ในตู้นิรภัย / safe deposit
3. Encrypted file ใน cloud drive (.gpg encrypted)

**Services ที่ต้องการความสำคัญสูงสุด:**
- GitHub / GitLab (source of truth)
- Apple Developer / Google Play Console (เกี่ยวกับ app signing)
- Domain registrar (ลูกค้าเข้าไม่ได้ถ้าโดน)
- Cloud provider (AWS, GCP, Firebase)
- Payment processor (Stripe)

### App Signing Keys (CRITICAL)

```bash
# Android — keystore file
cp ~/keystores/app.keystore /Volumes/Backup/credentials/
cp ~/keystores/app.keystore ~/cloud-encrypted/credentials/

# iOS — แนะนำใช้ App Store Connect "Cloud-managed" signing
# ถ้าใช้ manual: export .p12 + backup
```

**กฎ:** Android signing key หาย = update app ตลอดชีวิตไม่ได้ ต้องสร้าง app ใหม่ใน Play Console (เสีย user, rating, review ทั้งหมด)

### Environment Variables

```bash
# เก็บ .env.example ใน repo (sample values)
# เก็บ .env จริง ใน password manager / encrypted backup

# Pattern: ใช้ tool ที่ sync .env ปลอดภัย
# - Doppler, Infisical (managed)
# - SOPS + age (file-based encrypted)
```

## Vendor Lock-in Audit

ทุก quarter ตอบคำถาม:

```
สำหรับแต่ละ critical dependency:
[ ] Export ข้อมูลออกมาได้ไหม? (format อะไร)
[ ] ถ้า vendor ปิดบริการ → migrate ไปที่ไหนได้?
[ ] ถ้า account ถูก suspend → recovery process ยังไง?
[ ] ค่าใช้จ่ายในการย้ายออก = เท่าไหร่?
```

**High-risk patterns:**
- ❌ No-code platform ที่ไม่ export source code (Bubble, Glide บางตัว)
- ❌ Vibe coding platform ที่ source อยู่บน platform เท่านั้น (Lovable, Bolt บางช่วง)
- ❌ Database ที่ไม่มี native export (proprietary)
- ❌ Domain + hosting ที่ registrar เดียวกัน

**Mitigation:**
- Domain registrar คนละที่กับ hosting
- DB ใช้ standard format ที่ export ได้ทุกเมื่อ (Postgres dump, Firestore export)
- ทุก critical platform → schedule export อัตโนมัติ

## Disaster Recovery Plan

เขียน `DR_PLAN.md` ใน root (ทุก project critical):

```markdown
# Disaster Recovery Plan — Project XYZ

## Scenarios

### Scenario 1: Local machine destroyed
1. Get new device
2. Install: Git, Node.js v18+, Firebase CLI
3. Clone from GitHub: `git clone https://github.com/USER/REPO`
4. Restore .env from 1Password vault "XYZ Production"
5. Test: `npm run dev` → verify Firebase connection
- **RTO (Recovery Time Objective):** 4 hours

### Scenario 2: GitHub account banned
1. Restore from external SSD backup
2. Push to backup remote: GitLab account (set up as `git remote add gitlab ...`)
3. Update domain DNS to point to new hosting if needed
- **RTO:** 1 day

### Scenario 3: Firebase project deleted
1. Create new Firebase project (asia-southeast1)
2. Restore database from `fb-YYYYMMDD.json`
3. Update `.env` with new credentials
4. Deploy
- **RTO:** 6 hours
- **Data loss:** up to 7 days (since last backup)

### Scenario 4: Signing key lost (Android)
1. **CANNOT RECOVER** — must publish as new app
2. Mitigation: enable Play App Signing (Google manages key)
```

## Backup Hygiene Checklist

- [ ] Weekly Friday ritual ทำครบ 4 weeks ติดต่อกัน
- [ ] Quarterly restore test ผ่าน
- [ ] 2FA backup codes สำหรับทุก critical service
- [ ] Signing keys backup 3 ที่
- [ ] `.env.example` commit ใน repo
- [ ] DR_PLAN.md เขียนสำหรับ project critical
- [ ] Domain + hosting คนละ vendor
- [ ] Vendor lock-in audit ทำ quarterly

## Anti-patterns

- ❌ "ผมยังไม่ต้อง backup ตอนนี้ — project ยังเล็ก"
- ❌ "GitHub มี backup ของมันเอง" (account ถูก ban = ของหาย)
- ❌ Backup ลง drive เดียวที่อยู่บ้าน (ไฟไหม้ = หายหมด)
- ❌ Backup แต่ไม่เคย test restore (= ไม่มี backup จริง)
- ❌ Keep credential ใน plain text file

## Cost Reality Check

External 1TB SSD = ~2,000 THB (one-time)
Cloud backup 100GB/month = ~150 THB/month
Password manager = ~150 THB/month

**Total: ~5,000 THB/year**

เทียบกับ: รื้อ project ใหม่ทั้งหมดจาก zero = อย่างน้อย 100,000+ THB (เวลา + opportunity cost)

ROI = 20x ขั้นต่ำ
