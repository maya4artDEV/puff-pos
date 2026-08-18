---
name: writing-feature-specs
description: Apply spec-driven development to AI coding tasks by creating structured SPEC.md, PLAN.md, and TASKS.md artifacts before implementation, preventing AI drift and reducing rework. Use this skill at the start of any feature larger than a single function, when an AI agent has begun drifting from intent, when requirements are ambiguous, or when handing work off between AI sessions or between AI tools.
---

# Writing Feature Specs

> **Codex reference:** P-29 (Spec → Plan → Tasks Artifacts)
> **Based on:** GitHub Spec Kit, AWS Kiro, OpenSpec 3-phase, BuildBetter BB-Skills
> **When to load:** เริ่ม feature > 1 function, AI drift จาก intent, requirement ไม่ชัด, handoff ระหว่าง session/tool

## หลักการ

**ปัญหาที่ spec-driven แก้:** AI สร้างโค้ดที่ "ดูเหมือนถูก" แต่ drift จาก intent — ไม่มี artifact ที่จับต้องได้ระหว่างทาง → ไม่มีอะไรเทียบว่า "ทำตรงที่ตั้งใจ" ไหม

**Solution:** แยกออกเป็น artifacts ที่ commit ลง Git ก่อนเขียนโค้ด

```
SPEC.md   ← What + Why + Acceptance criteria
PLAN.md   ← How + Which files + Side effects
TASKS.md  ← Atomic checkboxes
[code]    ← Implementation
REVIEW.md ← Post-check vs SPEC
```

> **"Specs are the new code. The code is just the output."**

## Workflow (สำหรับ solo builder — simplified จาก GitHub Spec Kit)

```
1. SPECIFY  → เขียน SPEC.md (what + why + acceptance)
2. CLARIFY  → ถามคำถามจน ambiguity หมด (แก้ SPEC จนชัด)
3. PLAN     → เขียน PLAN.md (how + which files + risks)
4. TASKS    → แตกเป็น TASKS.md (atomic checkboxes)
5. ANALYZE  → ตรวจ conflict กับ Codex / pattern เดิม
6. IMPLEMENT → เขียนโค้ด (Work phase)
7. REVIEW   → เขียน REVIEW.md (check vs SPEC)
```

**ไม่ต้องทำครบทุกขั้นทุกครั้ง** — เริ่มจาก SPEC + TASKS อย่างน้อย ก็พอลด drift แล้ว

## Folder Structure

```
features/
  XYZ-add-baby-photo/
    SPEC.md       ← required
    PLAN.md       ← optional, ถ้า touch หลายไฟล์
    TASKS.md      ← required
    REVIEW.md     ← optional, ถ้า feature สำคัญ
```

Naming: `{ID}-{kebab-case-description}` — ID เป็น sequential หรือ ticket number

## SPEC.md Template

```markdown
# SPEC: [Feature Name]

**ID:** XYZ-001
**Status:** Draft | Clarified | Approved | Implemented | Archived
**Owner:** [name]
**Created:** YYYY-MM-DD
**Last updated:** YYYY-MM-DD

## What
[ประโยคเดียว — ทำอะไร]

## Why
[ปัญหาที่แก้ + ผู้ได้ประโยชน์]

## Out of Scope
[สิ่งที่ feature นี้จะ "ไม่" ทำ — สำคัญพอๆ กับ what]

## User Story
As a [role]
I want to [action]
So that [benefit]

## Acceptance Criteria (GIVEN/WHEN/THEN)

### Scenario 1: Happy path
GIVEN [precondition]
WHEN [user action]
THEN [expected result]
AND [additional check]

### Scenario 2: Error case
GIVEN [precondition]
WHEN [user action with error condition]
THEN [expected error handling]

### Scenario 3: Edge case
GIVEN [edge precondition]
WHEN [action]
THEN [expected behavior]

## Non-functional Requirements
- Performance: [response time, throughput]
- Security: [auth, data protection]
- Privacy: [PDPA compliance if applicable]
- Accessibility: [WCAG level if applicable]

## Dependencies
- Other features: [feature IDs]
- External services: [APIs, libraries]
- Data: [schema changes, migrations]

## Open Questions
- [ ] Question 1?
- [ ] Question 2?

## References
- Codex patterns: P-XX, P-YY
- Related skills: skill-name
- Design: [link]
```

## PLAN.md Template

```markdown
# PLAN: [Feature Name]

**Spec:** [link to SPEC.md]
**Status:** Draft | Approved | In Progress | Done

## Architecture Decision

[1-2 ย่อหน้า — approach ที่จะใช้ + เหตุผล]

## Files Affected

### New files
- `src/features/xyz/component.js` — new component
- `src/features/xyz/api.js` — API wrapper

### Modified files
- `src/app.js` — register new route
- `src/db/schema.json` — add new collection
- `index.html` — add nav link

### Single Source of Truth
[function/section ที่เป็น SOT ของ feature นี้]

## Side Effects

| File | Change | Risk | Mitigation |
|---|---|---|---|
| db/schema | New collection `photos` | Existing queries unaffected | Whitelist in rules (P-10) |
| app.js | New route handler | Could conflict with existing routes | Test route precedence |

## Codex Patterns to Apply

- P-01: Response status check ใน upload
- P-15: Storage budget check ก่อน save metadata
- P-23: Verify Firebase Storage API method
- P-28: Consent flow ก่อน collect

## Rollback Plan

ถ้า deploy แล้วเสีย:
1. Disable feature flag
2. Revert commit X
3. Restore DB schema from backup (P-24)

## Testing Strategy

- Unit: [components/functions to test]
- Integration: [flow to test end-to-end]
- Manual: [scenarios to walk through]
```

## TASKS.md Template

```markdown
# TASKS: [Feature Name]

**Spec:** [link]
**Plan:** [link]

## Pre-implementation
- [ ] SPEC reviewed and clarified
- [ ] PLAN approved
- [ ] Capture Log scanned for related learnings
- [ ] Dependencies verified

## Implementation
- [ ] Task 1: [atomic action — 1 commit]
  - [ ] Sub-task a
  - [ ] Sub-task b
- [ ] Task 2: [next atomic action]
- [ ] Task 3: [next atomic action]

## Verification (P-23)
- [ ] All imports verified in registry
- [ ] All API methods checked against docs
- [ ] Sandbox run successful
- [ ] Lint + type check pass

## Quality
- [ ] Acceptance criteria #1 met
- [ ] Acceptance criteria #2 met
- [ ] Acceptance criteria #3 met
- [ ] Non-functional requirements met

## Pre-deploy
- [ ] Codex pre-deployment checklist passed
- [ ] Backup taken (P-24)
- [ ] Feature flag configured

## Post-deploy
- [ ] Monitoring confirms healthy
- [ ] CAPTURE_LOG.md entry written
- [ ] REVIEW.md written (if applicable)
- [ ] SPEC.md status updated to "Implemented"
```

## REVIEW.md Template

```markdown
# REVIEW: [Feature Name]

**Spec:** [link]
**Implementation date:** YYYY-MM-DD
**Reviewer:** [self / AI agent #2 / human]

## Acceptance Criteria Check

### Scenario 1: ✅ PASS / ❌ FAIL
[evidence]

### Scenario 2: ✅ PASS / ❌ FAIL
[evidence]

## Codex Pattern Compliance

- P-XX: ✅ Applied / ❌ Missed (reason)
- P-YY: ✅ Applied

## Code Quality

- [ ] No duplicate logic introduced
- [ ] Single source of truth respected
- [ ] All side effects documented
- [ ] Tests pass

## Learnings (→ CAPTURE_LOG)

- **Win:** [what worked well]
- **Loss:** [what wasted time]
- **Pattern to extract:** [if any → promote to Codex]

## Follow-up

- [ ] Spec issues found → update SPEC.md
- [ ] Documentation update needed
- [ ] Related feature affected
```

## Clarify Phase Questions (ก่อนเขียน Plan)

ถามให้ครบจน answer ทุกข้อ:

```
Functional:
[ ] User input format? Range? Validation?
[ ] Error states? What error messages?
[ ] Empty state? Loading state?
[ ] Permissions required?
[ ] Offline behavior?

Data:
[ ] Schema for new data?
[ ] Existing data affected?
[ ] Migration needed?
[ ] Data retention?

UI:
[ ] Mobile + desktop both?
[ ] Accessibility requirements?
[ ] i18n needed?

Integration:
[ ] Which external APIs?
[ ] Rate limits?
[ ] Fallback if API down?

Edge cases:
[ ] What if user is offline?
[ ] What if storage full?
[ ] What if race condition (concurrent edits)?
[ ] What if PDPA consent withdrawn?
```

ถ้ายังไม่ clarify → **อย่าเขียน Plan**

## Analyze Phase (ก่อน Implement)

```
[ ] Conflict กับ feature ที่มี? (grep keywords)
[ ] Pattern เดิมใน Codex ที่ apply? (list)
[ ] Capture Log ที่ relevant? (link)
[ ] Skills ที่ relevant? (verifying-ai-output, backing-up, etc.)
[ ] Spec ของ feature อื่นที่เกี่ยวข้องไหม?
```

## When NOT to Use Spec-Driven

Spec-driven มี overhead — ใช้กับ task ที่คุ้ม:

✅ ใช้:
- Feature ใหม่ที่ touch หลายไฟล์
- Refactor ที่มี risk
- Integration ที่ซับซ้อน
- Feature ที่ต้อง handoff
- Anything ที่กระทบ user data (PDPA)

❌ ไม่ใช้ (overhead เกินคุณค่า):
- Typo fix
- Single function ที่ self-contained
- Experimental spike (เขียนเพื่อ learn, ไม่ ship)
- Hotfix ที่ urgent (ทำก่อน, doc ทีหลัง)

## Anti-patterns

- ❌ เขียน SPEC.md หลัง implement (ไม่ใช่ spec แล้ว — เป็น doc)
- ❌ SPEC ที่ vague ("good UX", "fast")
- ❌ Acceptance criteria ที่ไม่ testable
- ❌ Plan ที่ไม่ระบุ files
- ❌ Tasks ที่ไม่ atomic (1 task = 1 commit ได้)
- ❌ Skip CLARIFY phase แล้วเจอ ambiguity ตอน implement
- ❌ ไม่ update spec เมื่อ requirement เปลี่ยน

## Multi-Session Handoff

เมื่อ session ใหม่ (Claude/Cursor instance ใหม่) มาทำ feature ต่อ:

```
Agent should read in order:
1. AGENTS.md (project context)
2. BUILDER_CODEX.md (patterns relevant)
3. CAPTURE_LOG.md (recent learnings)
4. features/XYZ/SPEC.md (what to build)
5. features/XYZ/PLAN.md (how)
6. features/XYZ/TASKS.md (current state — which checkbox unchecked)
```

ถ้าครบ — agent ใหม่ resume ได้ทันที โดยไม่ต้อง re-explain

## Integration with Compounding Loop

| Loop phase | Spec artifact |
|---|---|
| **Plan** | SPEC.md + PLAN.md + TASKS.md |
| **Work** | Implementation + tick TASKS |
| **Review** | REVIEW.md |
| **Compound** | CAPTURE_LOG entry + promote pattern to Codex |

## Quick Decision

```
ขนาด feature?
   │
   ├── 1 function / typo ─────→ ข้าม spec, ทำเลย
   │
   ├── 1 file / clear scope ──→ SPEC + TASKS
   │
   ├── หลายไฟล์ / มี risk ───→ SPEC + PLAN + TASKS
   │
   └── critical / handoff ────→ SPEC + PLAN + TASKS + REVIEW
```

## Spec-Driven กับ Vibe Coding

Spec-driven ไม่ใช่ "anti-vibe" — มันคือ **"vibe ด้วย guardrails"**

- Vibe coding pure = describe → AI generate (ไม่มี spec) = drift
- Spec-driven vibe = describe → AI write spec → review → AI implement = aligned

Token cost:
- Pure vibe: ดูเหมือนถูก, จ่ายตอน rework
- Spec-driven: จ่าย upfront, แต่ลด rework 60-80%

ROI โดยเฉลี่ย: spec-driven ประหยัด 30-50% token + เวลา ตามรายงาน 2026
