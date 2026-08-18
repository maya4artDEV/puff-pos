---
name: debugging-discipline
description: Activate BEFORE proposing any fix for a bug, intermittent issue, or unexpected behavior. Mandatory trigger when user reports symptoms like "ยังผิด", "intermittent", "sometimes works", "works locally but not in production", "เกิดเฉพาะบางหน้า/บางคน", "ทำไมหน้านี้พังหน้านั้นไม่พัง", "I've tried fixing this 3+ times". CRITICAL: This skill stops AI agents from guessing fixes — it forces measuring before theorizing, holding multiple hypotheses, treating user reports as ground truth (not arguing back), and 6-layer verification before claiming "done". Use INSTEAD of jumping to solution. If you find yourself thinking "I bet it's X" before measuring — this is the trigger.
---

# Debugging Discipline

> **Purpose:** Stop AI agents from guessing fixes. Force evidence-based debugging.
> **When to load:** ก่อน propose fix ทุกครั้งที่เกี่ยวข้องกับ bug / unexpected behavior
> **Codex layer:** L5 Meta-cognitive (controls how AI thinks, not what it codes)

## The Core Problem

AI agents have 4 instincts that cause debugging disasters (Codex's 4 misbehaviors):

1. **เดา** — jump to "I bet it's X" before measuring
2. **โกหก** — claim "fixed" without proving causation
3. **ทำเกิน** — propose elaborate fix when measurement would diagnose
4. **ลืม** — argue with user's symptom report instead of trusting it

This skill enforces 7 disciplines + 6-layer verification to combat all 4.

---

## 🚦 The First Question (always)

Before ANY action, answer:

> **"Am I about to theorize, or measure?"**

If theorize → **STOP**. Go to D1.
If measure → proceed.

80% of bad debugging starts with skipping this question.

---

## 7 Disciplines

### D1. Measure Before Theorize

**Rule:** No hypothesis without ≥1 concrete measurement first.

**Measurement tool by bug type:**
| Bug type | Tool |
|---|---|
| Layout / UI | DevTools Computed panel — actual width/height of element AND parent |
| Logic / state | console.log actual values OR step debugger OR inspect storage |
| Async / timing | log timestamps before/after, watch order of operations |
| Network | DevTools Network tab — request, response code, timing |
| Data | query DB / storage directly, see actual stored values |
| Multi-actor | reproduce with 2 sessions/devices, observe interaction |

**Anti-pattern:**
> "ปัญหาน่าจะอยู่ที่ CSS — ลองแก้ position: absolute ดู" ← guess without measurement

**Correct:**
> "ก่อนแก้ — ขอ DevTools Computed width ของ #badge + parent .container ทั้งหน้าที่ทำงานและไม่ทำงาน" ← measurement first

---

### D2. Hold 3-5 Hypotheses — Disprove, Don't Prove

**Rule:** หลังมีข้อมูลแล้ว ตั้ง 3-5 hypotheses ก่อน design fix และพยายาม **disprove** แต่ละข้อ

**Why disprove instead of prove:**
- "Prove" → confirmation bias → หาแต่หลักฐานสนับสนุน
- "Disprove" → ตัดออกได้จริง → เหลือข้อที่เป็นไปได้สูงสุด

**Format:**
```
H1: <claim>      Test to disprove: <observable if H1 wrong>      Result: <pass/fail>
H2: <claim>      Test to disprove: ...                            Result: ...
H3-H5: ...
```

Single hypothesis without disproving test = forbidden.

---

### D3. Symptom = Ground Truth

**Rule:** เมื่อ user report ขัดกับ mental model ของเรา — **model ผิด ไม่ใช่ความจริงผิด**

**Triggers to pause + re-investigate:**
- "ยังผิด" → STOP arguing
- "I tried that already" → believe them, change angle
- "Works on my machine" → environment diff IS the bug
- "Sometimes works" → not random, hidden variable exists

**Anti-pattern:**
> User: "ยังผิดอยู่"
> AI: "แต่ผมแก้แล้ว — เคลียร์ cache หรือยัง?" ← arguing with ground truth

**Correct:**
> User: "ยังผิดอยู่"
> AI: "รับทราบ ขอ screenshot + console output ปัจจุบัน — re-investigate"

---

### D4. Differential Debugging

**Rule:** บั๊กอยู่ใน **diff** ระหว่างที่ work กับที่ไม่ work เสมอ

**Compare:** working page vs broken page / working device vs broken / before bug vs after (git bisect) / dev vs production.

**Smallest diff = highest signal.** Bug hides in smallest detail.

**Process:**
1. Identify working baseline (must exist)
2. Identify broken case
3. List ALL differences (no matter how trivial)
4. Eliminate one-by-one until cause isolated

---

### D5. Right Tool for Bug Type

**Rule:** ใช้ inspection tool ตรงกับ bug type — ไม่ debugger-first ทุกครั้ง

| Bug type | First tool (cheapest, highest signal) |
|---|---|
| Layout | DevTools Computed + Elements panel |
| Logic | console.log key values OR debugger breakpoint |
| Async / order | console.log with timestamps |
| Network | DevTools Network tab |
| Storage | DevTools Application tab → inspect actual data |
| Race condition | logging at every actor + reproduce with delay |
| Build / deploy | check deployed artifact (md5/hash) vs source |

**For AI agents (no live debugger):** grep file content, ask user to read specific computed value, run script against actual file. **Measure real artifact, never assume from memory.**

---

### D6. Toggle Test (Prove Causation)

**Rule:** เจอ "สาเหตุ" ยังไม่พอ — ต้อง **toggle** ดูว่า symptom มา-หายตามได้

```
1. Apply fix    → bug should disappear
2. Revert fix   → bug should return
3. Apply again  → bug should disappear again
```

Pass ทั้ง 3 → causation proven. ไม่ผ่าน → แค่ correlation.

---

### D7. Reproduce as Goal, Not Gate

**Rule:** Reproduce เป็น **เป้าหมาย** ไม่ใช่ ประตูที่ผ่านไม่ได้แล้วยอมแพ้

**Can reproduce directly:** ใช้เลย ทดสอบ hypotheses

**Can't reproduce directly:**
- ❌ Don't say "reproduce ไม่ได้" + เดา fix
- ✅ Change task to "make it reproducible":
  - Add logging / telemetry
  - Narrow conditions
  - Collect ≥3 occurrences
  - Find correlation pattern

Forbidden: reproduce-fail + guess-fix combo (double failure).

---

## 🔒 6-Layer Verification (Before Claiming "Fixed")

ห้าม claim "เสร็จ" จนกว่าผ่าน 6 layers:

### V1. Toggle Test
Apply → bug gone. Revert → bug returns. Apply → bug gone.

### V2. Regression Check
เคสที่ดีอยู่แล้ว ยังดี? (เช่น Overview page ยังต้อง work)

### V3. All Instances
ทุก case ที่ report ว่าพัง → ต้องหายหมด ไม่ใช่แค่ที่ทดสอบ

### V4. Minimality — No Compensating Hack 🚨
**สำคัญที่สุด:** ถ้ายังเห็น `calc()`, negative margin, `!important`, position absolute, z-index ที่ใส่เพื่อ "ชดเชย" — **ยังกลบอยู่ ไม่ใช่แก้**

> "ถ้ารู้สึกว่ากำลัง edit เพื่อ compensate มากกว่า root fix → หยุด นั่นคือกำลังรักษาอาการ"

### V5. Automated Check Re-runs
Lint pass / type check / syntax check (`node --check`) / DOM structure script / test suite — re-run ทั้งหมด

### V6. Verify Deployed Artifact
ตรวจ deployed version จริง — ไม่ใช่ source ในหัว Hard reload + clear cache. Check md5/hash. "เขียนแล้ว" ≠ "deploy แล้ว"

---

## 🚨 Red Flag Phrases — Self-Check

ถ้า AI พิมพ์/คิดประโยคพวกนี้ → **trigger skill ทันที**:

- "I bet it's..." / "น่าจะเป็นที่..."
- "ลองแก้ X ดูก่อน" / "Try this..."
- "Should work now" / "อาจจะเป็น..."
- "Probably the issue is..." / "Quick fix: ..."

ทุกประโยคพวกนี้ = AI กำลัง **theorize without measurement** → หยุด → กลับไป D1

---

## 🪞 3 Real-Failure Anti-Patterns

### #1: Element ผิด ก็แก้ element (skip parent)
```
❌ User: "Badge แสดงผิด" → AI: แก้ CSS ของ badge → ไม่หาย → แก้อีก → 6 รอบ
✅ AI: วัด parent ของ badge ก่อน → parent = 149px (ควร 810px) → ปัญหาที่ parent
```
*From Role Banner bug post-mortem*

### #2: ใช้ DevTools เพื่อพิสูจน์ตัวเองถูก (ไม่ใช่หาว่าผิด)
```
❌ AI: แก้ position: absolute → เปิด DevTools confirm CSS rule active = "ดูสิ ถูกแล้ว"
✅ AI: เปิด DevTools หา anomaly — วัดทุกชั้นของ parent, เทียบกับสิ่งที่คาด
```
*Pattern ที่ลึกที่สุด — เครื่องมือเดียวกัน ใช้คนละทิศ ผลต่างกัน 100%*

### #3: เถียงกับ user ที่บอก "ยังผิด"
```
❌ User: "ยังผิดนะ" → AI: "แต่ผมแก้แล้ว — เคลียร์ cache หรือยัง? ไฟล์เก่าหรือเปล่า?"
✅ User: "ยังผิดนะ" → AI: "รับทราบ ขอ screenshot + DevTools value — re-investigate"
```
*Violation ของ D3 = สิ้นเปลือง trust + เวลา + เผา session*

---

## 🧬 Connection to Codex

This skill operationalizes:
- **4 Misbehaviors framework** — directly combats เดา (D1, D2) + โกหก (V1-V6) + ทำเกิน (V4) + ลืม (D3)
- **P-30 AI as Second Reviewer** — disproving hypothesis = self-review
- **P-31 R0/R1/R2** — debugging fixes usually R1, must report what + why + rollback
- **Compounding Loop** — every bug caught → log to `MEMORY.md` (operational) + `CAPTURE_LOG.md` (strategic)

When a bug exposes a new pattern (e.g., "extra div in 10k-line HTML"), promote it to Codex Pattern Library.

For output format and memory entry schema → see Codex `AGENTS.md` (output section) and `MEMORY.md` (3-field schema).

---

## 🪐 Final Rule

> **If you feel certain about the cause without measuring — that certainty is the bug.**

Trust measurements over intuition. Trust user symptoms over your model. Verify causation, not correlation. Six layers before "done".

---

*Synthesized from: Tony's debugging framework + Role Banner bug post-mortem + universal debugging discipline literature. Universal — applies to layout / logic / async / network / data / multi-actor bugs equally.*
