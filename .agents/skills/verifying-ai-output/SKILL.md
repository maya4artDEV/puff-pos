---
name: verifying-ai-output
description: Verify code that an AI agent has just generated before accepting it, specifically catching hallucinated imports, fake API methods, non-existent library versions, and schema mismatches. Use this skill before committing any AI-generated code, after the AI claims a library does X without citing official docs, or when reviewing a pull request from an autonomous coding agent.
---

# Verifying AI Output

> **Codex reference:** P-23 (AI Hallucination Guardrails)
> **When to load:** ก่อน commit โค้ดจาก AI agent ทุกครั้ง, หลัง AI อ้าง library behavior โดยไม่มี docs URL, ก่อน merge PR จาก autonomous agent

## หลักการ

AI ทุกตัว (ไม่ว่า frontier model แค่ไหน) hallucinate ได้ — โดยเฉพาะ:
- **Import statement** ที่ library ไม่มีจริง
- **API method** ที่ deprecated หรือไม่เคยมี
- **Type signature** ที่ใกล้เคียงของจริงแต่ไม่ตรง
- **Config schema** ที่ generic จาก similar pattern

**กฎทอง:** ถ้า AI ตอบ "ตามปกติ library นี้จะ..." โดยไม่อ้าง docs URL จริง → **เป็นสัญญาณ hallucination 80%**

## Mandatory Verification Steps (ก่อน accept โค้ด)

### Step 1: Import / Dependency Check

```bash
# JavaScript/TypeScript
npm ls --depth=0                    # ดู unused / missing
npm view <package-name> versions   # ตรวจว่ามี version นั้นจริงไหม

# Python
pip show <package-name>            # ตรวจ installed + metadata
pip index versions <package-name>  # ตรวจ available versions
```

**Red flags:**
- Package name แปลกๆ ไม่เคยเห็น → search npm/PyPI ก่อนใช้
- Version pin ที่ specific เกินไป (เช่น `1.2.3-beta.42`) → check release history
- AI บอก "ใช้ library ABC" แต่หาใน registry ไม่เจอ → hallucination ชัดเจน

### Step 2: API / Method Check

```bash
# JavaScript
grep -rn "library_name\." src/    # หาทุกที่ที่เรียก method ของ library นั้น
# แล้วเทียบกับ docs จริงของ provider
```

**Process:**
1. List ทุก `library.method()` ที่ AI generate
2. เปิด official docs (ไม่ใช่ Stack Overflow ที่ AI อาจ paraphrase ผิด)
3. ตรวจ method exists + signature ตรง + return type ตรง

**Common hallucination patterns:**
- AI generate method ที่ "น่าจะมี" จาก naming convention (เช่น `.findOrCreate()` ที่ ORM นั้นเรียก `.upsert()`)
- AI ผสม API จาก 2 library คล้ายกัน (Firebase v8 vs v9 syntax)
- AI generate deprecated method ที่อยู่ใน training data

### Step 3: Schema / Config Verification

```bash
# Firebase rules — ตรวจ path ใน code ตรงกับ rules
cat database.rules.json | grep -A2 "your_path"

# DB column — query schema จริงจาก provider
# Postgres
psql -c "\d your_table"
# Firebase Realtime DB
firebase database:get /your_path --shallow
```

**Verify:**
- Field names ตรง case-sensitive
- Type ตรง (number vs string vs boolean)
- Required vs optional ตรง
- Validation rules ตรง

### Step 4: Run in Sandbox

```bash
# สร้าง isolated test ก่อน integrate
# Node.js
node -e "const X = require('./new-code.js'); X.test()"

# Python
python3 -c "from new_module import test; test()"

# Browser
# เปิด DevTools → paste function → run with mock input
```

**กฎ:** ทุกโค้ดใหม่ต้อง run อย่างน้อย 1 รอบ **ก่อน** commit — ไม่ใช่หลัง

### Step 5: Static Analysis Pass

```bash
# JavaScript
npx eslint --no-eslintrc --rule '{"no-undef": "error"}' new-code.js
npx tsc --noEmit new-code.ts

# Python
mypy new-code.py
pyflakes new-code.py
```

จับ:
- Undefined function calls (hallucinated)
- Type mismatch ที่ AI ไม่เห็น
- Unused imports (AI generate แต่ไม่ใช้)

## Quick Decision Tree

```
AI generate โค้ด
     │
     ├── อ้าง library / method ที่คุ้น? ─── No ──→ Step 1+2 บังคับ
     │                                  Yes
     │                                   ↓
     ├── เคย run library นี้สำเร็จมาก่อน? ─── No ──→ Step 3+4 บังคับ
     │                                       Yes
     │                                        ↓
     ├── โค้ดแตะ schema / config? ─── Yes ──→ Step 3 บังคับ
     │                              No
     │                               ↓
     └──────────────→ Step 4 + 5 อย่างน้อย ──→ Commit ได้
```

## Red Flag Phrases (signal hallucination)

ถ้า AI ตอบด้วยวลีพวกนี้ → ขอ docs URL ก่อนรับโค้ด:

- "ตามปกติ library นี้จะ..."
- "I believe this method..."
- "This should work because..."
- "Most libraries handle this by..."
- "Based on similar APIs..."

**ถามต่อ:** "อ้างจาก docs ตรงไหน? ขอ URL"

ถ้าตอบไม่ได้ / ให้ URL ปลอม → **hallucination ยืนยัน**

## Automation Pattern (CI / pre-commit)

```yaml
# .github/workflows/verify.yml
name: Verify AI Output
on: pull_request
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check dependencies exist
        run: npm ci && npm ls --depth=0
      - name: Lint for undefined
        run: npx eslint . --rule '{"no-undef": "error"}'
      - name: Type check
        run: npx tsc --noEmit
      - name: Run sandbox tests
        run: npm test
```

## Logging Pattern

ทุกครั้งที่จับ hallucination ได้ → log ลง `CAPTURE_LOG.md`:

```markdown
## YYYY-MM-DD — Hallucination caught
- **Context:** AI claimed `firebase.database().refOnce()` (method doesn't exist)
- **Reality:** Correct method is `.once('value')`
- **Cost saved:** ~30 min debugging if had merged
- **Pattern:** AI mixed v8 + v9 Firebase syntax
- **Defense:** Added "verify Firebase method version" to checklist
```

## Anti-patterns (สิ่งที่ห้ามทำ)

- ❌ Trust AI's claim about library behavior without docs URL
- ❌ Skip sandbox run because "looks correct"
- ❌ Accept code with TODO/FIXME ที่ AI ใส่ไว้
- ❌ Merge โดยไม่ run lint + type check
- ❌ Believe Stack Overflow citation ที่ AI paste — ตรวจกับ original

## Success Criteria

ก่อน mark task complete:
- [ ] ทุก import ตรวจมีจริงใน registry
- [ ] ทุก API method ตรวจกับ official docs
- [ ] Schema ตรงกับ source จริง
- [ ] Sandbox run pass อย่างน้อย 1 รอบ
- [ ] Static analysis pass (no undef, no type error)
- [ ] ถ้าจับ hallucination ได้ → log ลง CAPTURE_LOG
