---
name: hard-task-protocol
description: >-
  Protocol for decomposing hard tasks, verifying your own work before claiming
  completion, and deciding the next action. Use this skill whenever a task is
  multi-step, ambiguous in scope, touches production code or shared state
  (Firebase, localStorage, deployed Workers, live branch systems), spans
  multiple files, or when a previous attempt at the same task failed. Also
  trigger when the user says "plan first", "review first", "refactor",
  "this keeps breaking", or asks for anything you cannot fully hold in your
  head at once. Do NOT skip this on "simple-looking" requests that modify
  shared state — misjudging difficulty is the first failure mode this skill
  exists to prevent.
compatibility: Model-agnostic. Written for Opus 4.8 and current/future Sonnet-class models; no tools required beyond whatever the task itself needs.
---

# Hard Task Protocol

The operating loop:

```
CLASSIFY → DECOMPOSE → EXECUTE (smallest risky step first) → VERIFY → CAPTURE → DECIDE → repeat
```

Every section below is one node in that loop. The loop is cheap — one pass costs
a few sentences of thinking. Skipping it costs hours of fix-loops.

---

## 1. CLASSIFY — before touching anything

Answer two questions in one or two lines each. Write them down (in the plan,
in a scratch note, in the response — anywhere visible).

**Q1: Is this actually hard?** Signals that it is:
- More than ~3 dependent steps
- Ambiguous scope ("improve", "clean up", "make it work")
- Unfamiliar API, library, or codebase section
- A previous attempt already failed
- Output will be trusted without human line-by-line review

**Q2: What is the reversibility class of the worst action in this task?**

| Class | Examples | Required behavior |
|---|---|---|
| Reversible | edit a local file, draft text, run a read-only query | Just do it. Verify after. |
| Costly to reverse | schema change, refactor across files, overwrite config | Show the diff or plan first. State side effects before executing. |
| Irreversible | delete data, send message, deploy to prod, write to live Firebase | Stop. Confirm with the user explicitly before acting. No exceptions. |

If the task mixes classes, the plan must isolate the irreversible steps at the
end, after everything reversible has been verified.

---

## 2. DECOMPOSE

Rules for a decomposition that actually helps (vs. plan theater):

1. **One-sentence definition of done.** If you cannot state what "done" looks
   like as an observable fact ("the render function produces X and the console
   shows no errors"), you do not understand the task yet — go read more before
   planning.
2. **Name the single source of truth being modified.** Which function, file,
   or record owns this behavior? If two candidates exist, that conflict is
   subtask #1, not a footnote.
3. **Split into checkpoints, not phases.** Each subtask must end in something
   *checkable*: a file that exists, a test that passes, an output you can read.
   "Understand the codebase" is not a subtask; "list the 3 functions that touch
   order state" is.
4. **Riskiest step first.** Front-load the piece most likely to invalidate the
   plan (the unfamiliar API call, the ambiguous requirement, the integration
   point). Failing fast at step 1 is cheap; failing at step 7 wastes steps 1–6.
5. **Read before write.** Any file, doc, or schema the task depends on gets
   read before code is written against it. Never write against a remembered
   version of a file.
6. **Keep the plan live.** When reality diverges from the plan, update the
   plan explicitly — do not silently improvise while the stale plan sits there
   pretending to be followed.
7. **List side effects now.** For each subtask that writes anything: what else
   reads this? What breaks if the shape changes? This list becomes the
   verification checklist in step 4.

---

## 3. EXECUTE

- One checkpoint at a time. Do not batch three risky changes and verify once.
- If mid-execution you discover the plan is wrong: stop, revise the plan,
  state what changed. Continuing on a known-wrong plan is the expensive path.
- If scope grows ("while I'm here I could also...") — flag it, do not do it.
  Silent scope expansion is how unrelated sections get rewritten.

---

## 4. VERIFY — before claiming anything is done

**Core rule: verification must be a different action than production.**
Re-reading the code you just wrote with the same assumptions that produced it
finds nothing. Change the mode:

- Wrote code → **run it**. If it can't be run, trace it line by line as a
  hostile reviewer, with actual sample values, not vibes.
- Produced a file → **open and render it** (view the PDF, load the HTML,
  re-read the diff as raw text).
- Made a factual claim → **point to the source**, or explicitly relabel it
  as an assumption.
- Refactored → **diff against the original** and confirm nothing outside the
  stated scope changed.

**The checklist** (built from step 2):
1. Does the output match the one-sentence definition of done? Literally, not
   approximately.
2. Every side effect listed during decomposition — checked?
3. Any duplicate logic introduced? (New function doing 80% of what an existing
   one does = failure, even if it works.)
4. Error paths: what happens on null, empty, quota-exceeded, network failure?
   Test at least one unhappy path, not just the demo case.
5. Known bug classes for this codebase — explicitly scan for each one. Generic
   review misses codebase-specific traps; a named checklist does not.

**Honesty rules:**
- "Should work" means **not verified**. Say "not verified" instead.
- If verification is impossible in the current environment (no runtime, no
  test data), state exactly what was and wasn't checked. Downgraded confidence
  stated plainly beats inflated confidence discovered in production.

---

## 5. CAPTURE — 2–3 lines, every significant cycle

After each verify step (pass or fail), record:
- What worked
- What broke or surprised
- Which assumption was wrong

This is not journaling for its own sake. Captures are the input to upgrading
the workflow — a recurring entry ("third time template literals crashed a
render function") is a signal to change the rules, not to fix faster.
Skipping capture = repeating the same session at higher speed.

---

## 6. DECIDE — what to do next

Deterministic decision table. Match the first row that applies:

| Situation | Next action |
|---|---|
| Verification passed, task done | Deliver + capture. Stop. Do not gold-plate. |
| Verification failed, first time | Diagnose root cause, fix, re-verify. Fix the cause, not the symptom. |
| Same bug survived **2 fix attempts** | STOP patching. Re-diagnose from zero: re-read the actual code/data, question the original assumption. Two failed fixes means the mental model is wrong, not the patch. |
| Blocked on info **you can obtain** (a file you can read, a command you can run, a doc you can search) | Obtain it. Do not ask the user for things you can check yourself. |
| Blocked on info **only the user has** (intent, preference, business context) | Ask ONE question, with your recommended default attached, then stop and wait. |
| Next step is irreversible | Confirm with the user first. Present exactly what will happen. |
| Scope has grown beyond the original request | Deliver the original scope; list the extra work as a proposal, not a fait accompli. |
| Context/session getting long, task splittable | Proactively propose a split with a handoff summary. Do not degrade quietly. |

---

## Anti-patterns (each one has a name so it can be caught mid-act)

- **Plan theater** — writing an elaborate plan, then improvising anyway.
  A plan that isn't updated when reality diverges is decoration.
- **Confidence inflation** — reporting "done" or "should work" without a
  verification action. The single most damaging habit in agent work.
- **Fix-looping** — patching the same symptom 3+ times. Triggers the
  mandatory stop-and-rediagnose rule above.
- **Happy-path verification** — testing only the demo input. Unhappy paths
  are where production dies.
- **Silent scope expansion** — "improving" code the user never asked about.
- **Parallel-logic creep** — writing a new function instead of extending the
  existing single source of truth. Works today, forks the truth forever.
- **Lazy asking** — asking the user something a 10-second file read would
  answer. Burns the user's time to save the agent's.
- **Stale-context writes** — editing a file based on how it looked earlier
  in the session instead of re-reading it first.

---

## Minimal footprint version (when the task turns out to be easy)

If CLASSIFY says the task is genuinely simple and fully reversible, the whole
protocol collapses to two lines:

1. State what "done" looks like.
2. Verify with one action different from production before delivering.

Never less than that.
