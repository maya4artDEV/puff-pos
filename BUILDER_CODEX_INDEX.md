# Builder Codex — Executive Index
## Pattern Reference Card (token-efficient loader)

> **เวอร์ชัน:** 3.3.0 (Grilling Edition)
> **Companion to:** `BUILDER_CODEX.md` (full content, ~755 lines)
> **This file:** ~150 lines — load this ALWAYS; load full only when deep-dive needed
> **Token cost saving:** ~65% vs loading full Codex every session

---

## 🚦 How to Use This Index

1. **Agent loads this index every session** (as part of AGENTS.md `@import` or Project Knowledge)
2. **For any task:** scan pattern names + 1-line rules → identify which apply
3. **Deep-dive only when needed:** open `BUILDER_CODEX.md` to specific `#### P-XX` heading

---

## 🎯 The 4 AI Misbehaviors (Mental Anchor)

Every pattern maps to combating one of these:

| Misbehavior | Symptom | Combat patterns |
|---|---|---|
| **เดา** (Guess) | Hallucinate imports/APIs, invent fields | P-23, P-32 |
| **โกหก** (Lie) | Claim "fixed" without proving | P-34, debugging-discipline |
| **ทำเกิน** (Overreach) | Scope creep, refactor uninvited | P-21, P-31, P-36 |
| **ลืม** (Forget) | Repeat past mistakes | MEMORY.md, CAPTURE_LOG, P-26 |

---

## 🔄 Compounding Loop (mandatory for every session)

```
Plan (read Codex + Capture Log) → Work (per plan) → Review (verify) → Compound (write Capture)
```

**80% = Plan + Review. 20% = Work.** No plan = no code.

---

## 🧠 Pattern Library — Quick Reference

### Foundation (P-01 → P-08) — Network, Sync, Update

- **P-01** — Check response status on every write (HTTP + logic)
- **P-02** — Mark & Retry: `markUnsynced` / `clearUnsynced` / `retryUnsynced`
- **P-03** — Visible state: every async needs UI feedback (info/success/danger)
- **P-04** — Timestamp dual: `createdAt` + `syncedAt` (null until push succeeds)
- **P-05** — Local timestamp sync after push
- **P-06** — Reload to sync after config changes
- **P-07** — Credential rotation: new → test → deploy → wait → revoke old
- **P-08** — Auto-update (3 layers): no-cache meta + version const + cloud check

### Architecture (P-09 → P-14)

- **P-09** — Background sync limits: can retry on open + Service Worker; can't push-pull closed clients
- **P-10** — DB rules: whitelist approach (deny by default)
- **P-11** — Don't hide secrets in client code (visible via DevTools always)
- **P-12** — Single source of truth = Git (pull before agent, push after)
- **P-13** — Hybrid notification: client instant + server cron failsafe
- **P-14** — Telemetry First: health ping + error reporter + storage failure reporter

### Robustness (P-15 → P-18)

- **P-15** — Storage Budget: estimateStorageSize + attemptStorageCleanup, cap <4MB
- **P-16** — Verified Writes: `lsSet()` returns boolean, cleanup+retry on quota
- **P-17** — Element Cleanup Discipline: grep before delete, null-safe getElementById always
- **P-18** — Active Polling: admin/monitoring auto-refresh 30s, no-cache

### Process (P-19 → P-22)

- **P-19** — Optional Actions After confirmation: share/export/print AFTER save-to-SOT
- **P-20** — Multi-AI Lockfile: `AI_LOCK.md` + feature branches + PR merge
- **P-21** — Don't over-architect: restore working systems first (partial break = fix that part only)
- **P-22** — Defense in Depth: primary fast + secondary reliable + tertiary manual

### Solo Survival (P-23 → P-30)

- **P-23** — AI Hallucination Guardrails: verify every import/API against docs, sandbox run before commit
- **P-24** — Backup Discipline: 3-2-1 rule for solo (weekly ritual, quarterly restore test)
- **P-25** — Token/Cost Budget: dashboard weekly, hard limits, `/compact` at 60%
- **P-26** — Context Management: `/compact` 60%, `/clear` on topic switch, checkpoint before destructive
- **P-27** — Mobile Store Submission gate (Play/App Store review compliance)
- **P-28** — PDPA / Data Minimization (Thai market baseline)
- **P-29** — Spec → Plan → Tasks Artifacts (SPEC.md + PLAN.md + TASKS.md per feature). `/clarify` = **Grilling**: design tree + frontier rounds, numbered Q + recommended answer, agent finds facts itself, never acts until frontier is empty
- **P-30** — AI as Second Reviewer (Pass 1 writes, Pass 2 reviews with 5 standard questions)

### Behavioral (v3.1.0)

- **P-31** — R0/R1/R2 Reversibility Classification:
  - **R0** (irreversible) → STOP, ask first
  - **R1** (costly to reverse) → do it, report what+why+rollback
  - **R2** (easily reversed) → just do it, brief report

### Structural Integrity (v3.2.0)

- **P-32** — Structure-Read Gate: before spec/brief that moves component, **read source body this session**. Every brief has `Structure verified:` header with function/DOM + line numbers. Handoff/memory/label = pointer, not substitute.

- **P-33** — No-Regenerate / Encoding-Safe Edit Gate: NEVER regenerate whole file. Python replacement: `open(p,'r',encoding='utf-8',newline='').read()` + `assert str.count(old)==1` before each replace + `open(p,'w',encoding='utf-8',newline='')`. CRLF preserved, no BOM, Thai integrity intact.

- **P-34** — Nova-Reference Byte-Diff Acceptance Gate: acceptance = Nova reads real source → applies edit to own reference → verifies (bytes/CRLF/lone-LF/brace balance/`node --check`/content assert) → **`cmp -s` agent's file vs reference**. Agent-reported metrics = claims to verify, NOT acceptance. Pre-build reference BEFORE handoff.

- **P-35** — Coding-Agent Env-Note Header: every brief has "⚙️ Agent env — read FIRST" section covering save-script-as-`.py` + run `py` (not `python -c`), skip `node --check` (Nova does it), PowerShell fallback = `[IO.File]::WriteAllText` + `[System.Text.UTF8Encoding]::new($false)` (BOM-free, CRLF/Thai-safe).

- **P-36** — Goal-Lock & Minimal Footprint (ALWAYS ON):
  1. Restate origin goal in 1 line before ANY proposal
  2. Core capability = never silent-defer, only NAMED phase
  3. Simplest-correct stands; dismissal must name concrete failure
  4. Footprint declaration before any infra/dep/hosting/auth/domain
  5. Cost-lock: verify pricing vs bound BEFORE commit

### Grilling Method (v3.3.0 🆕 — folded into P-29, not a standalone number)

- **Design tree** — every decision branches into the decisions hanging off it
- **Frontier** — only ask decisions whose prerequisites are already settled
- **Round format** — numbered question + your recommended answer, ask the whole frontier at once
- **Facts vs decisions** — agent finds facts itself (code/docs/filesystem); only decisions go to the user
- **Done when frontier is empty** — never act until the user confirms shared understanding
- Source: `mattpocock/skills` → `utarn/engineer-skills` (fork, extends into `grill-with-docs`, `grill-novice`, `handoff` — P-38/P-39 candidates, still parked)

---

## 📦 Standard Files (per project)

```
AGENTS.md        — Tier 1, <150 lines, agent auto-loads
MEMORY.md        — AI's operational failure log (3-field: what/root cause/correct)
CAPTURE_LOG.md   — Human's strategic learning log
spec.md          — Project save point (Architecture/Done/Todo/Current state)
BUILDER_CODEX.md  — Tier 3 full reference
BUILDER_CODEX_INDEX.md          — THIS FILE (always loaded)
skills/{name}/SKILL.md          — Portable capabilities on-demand
features/{XYZ}/SPEC.md          — Per-feature specs (≠ project-level spec.md)
```

---

## 🎓 Mantras (compressed)

- "Trust the data, not the silence." — make invisible visible
- "Restore before redesign." — fix broken, don't rebuild working
- "Defense in depth: primary fast, secondary reliable."
- "Plan → Work → Review → Compound." 80% Plan+Review.
- "Same interface, always." — internals change, entry point forever
- "Solo = single point of failure by default. Backup is the job."
- "If AI can't cite docs URL, it's hallucinating 80% of the time."
- "Specs are the new code. Code is just the output."
- "If certain about cause without measuring — that certainty IS the bug." (debugging-discipline)
- "Byte-diff, not metric-report." (P-34)
- "Goal-lock before proposal." (P-36)
- "Ask the whole frontier, wait for the answer, never act until the tree is settled." (Grilling, P-29)

---

## ⚠️ When Deep-Dive Needed → Open `BUILDER_CODEX.md`

Load full only when:
- Implementing a pattern for first time (need full example)
- Debugging why pattern didn't work (need anti-patterns section)
- Onboarding new project (need §Standard Files + §Pre-Deployment Checklist)
- Post-incident review (need §10 Acknowledgements + Compound Loop guidance)

Otherwise: THIS INDEX IS ENOUGH.

---

*Executive Index generated from Builder Codex v3.3.0 (2026-09-24). Update when new patterns promote or old patterns deprecate. Index and Master must stay in sync.*
