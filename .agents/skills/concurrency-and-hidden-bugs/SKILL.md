---
name: concurrency-and-hidden-bugs
description: Use this skill whenever writing, modifying, reviewing, or planning any code that touches shared state, async operations, or anything that runs more than once at the same time. Triggers include Firebase writes, localStorage updates, counters, ID generation, multi-user/multi-branch/multi-tab features, real-time sync, async/await chains, event listeners, optimistic UI updates, or Google Apps Script Sheets writes. Also triggers on phrases like "add feature to", "fix bug in", "review my code", "audit", "refactor", "why does this happen sometimes", "works locally but not in production", "order ID duplicated", "data overwritten", "lost updates", "stale data", "race condition", "concurrency", "deadlock", "sync issue", "intermittent bug". CRITICAL: AI agents notoriously skip concurrency analysis — this skill must trigger even when the user describes a feature in non-technical terms (e.g., "let two branches order at the same time" implicitly requires concurrency review).
---

# Concurrency & Hidden Bugs Guard

A guard skill that forces explicit concurrency and hidden-bug analysis before writing code, and a checklist for auditing existing code.

This skill exists because AI coding agents — including me — tend to:
- ✅ Read code line-by-line and miss timing-dependent bugs
- ✅ Generate code that "looks right" but breaks when 2+ actors hit it simultaneously
- ✅ Skip the "what if the network drops mid-write?" question
- ✅ Forget that localStorage / IndexedDB / Firebase don't enforce serialization the way a database does

This skill stops that. It has two modes.

---

## When to use which mode

| Situation | Mode | Output |
|---|---|---|
| About to write a new feature | **PRE-FLIGHT** | 6 questions answered before any code is written |
| Reviewing existing code | **AUDIT** | Scan against 13 patterns, output risk list |
| Bug is intermittent / "sometimes works" | **AUDIT** + **PRE-FLIGHT** for the fix | Identify the race, design fix with pre-flight |
| User says "add feature X" without context | **PRE-FLIGHT first**, do not write code yet | Question list |

If unsure → default to **PRE-FLIGHT**. Cheaper to ask than to ship a race condition.

---

## MODE 1 — PRE-FLIGHT (before implementing)

Before writing ANY code that touches shared state, answer these 6 questions out loud. If any answer is "I don't know" or "not handled", **stop and design first**. Do not write code.

### The 6 Pre-Flight Questions

**Q1. Who else can write to this state at the same time?**
- Other users? Other branches? Other tabs of the same user? A scheduled job? An admin override?
- If the answer is "just one actor ever" → safe to proceed.
- If the answer is "2+ actors" → continue to Q2.

**Q2. What happens if two writes arrive in the same millisecond?**
- Last-write-wins? Lost update? Duplicate ID?
- Required answer: name the strategy (transaction, queue, lock, CRDT, last-write-wins-and-that's-acceptable).

**Q3. What happens if the operation fails halfway through?**
- Network drops after write 1 but before write 2.
- User closes the tab during async op.
- Required answer: name the rollback or recovery strategy. "It won't fail" is NOT acceptable.

**Q4. What happens if the user is offline, then comes back online?**
- For Firebase RTDB / Firestore: offline writes queue locally then sync. What if conflict?
- For localStorage: nothing syncs — is that OK?
- Required answer: explicit offline behavior.

**Q5. What's the single source of truth for this state?**
- localStorage? Firebase node? Google Sheet cell?
- If the answer involves "both X and Y" → the bug is here. Pick one.

**Q6. Is there a counter, ID, or sequential field involved?**
- Order IDs, invoice numbers, queue positions, version numbers.
- If yes → must use an atomic operation (Firebase `transaction()` / `increment()`, Sheets `LOCK`, or a single-writer pattern). Client-side `lastId + 1` is ALWAYS wrong with 2+ actors.

### Pre-flight output format

When triggered in pre-flight mode, respond with:

```
PRE-FLIGHT for: <feature name>

Q1. Concurrent writers: <answer>
Q2. Same-millisecond strategy: <answer>
Q3. Mid-operation failure: <answer>
Q4. Offline → online: <answer>
Q5. Single source of truth: <answer>
Q6. Counter/ID involved: <answer> [+ atomic strategy if yes]

RISKS IDENTIFIED:
- <risk 1>
- <risk 2>

PROCEED? <yes / no / need more info>
```

Only after the user confirms → write code.

---

## MODE 2 — AUDIT (review existing code)

Scan the code against these 13 patterns. For each match, output: location + risk + suggested fix.

### Category A: Concurrency

**A1. Read-modify-write without atomicity**
- Pattern: `const x = await read(); x.count++; await write(x);`
- Risk: Two concurrent operations both read the same value, both write +1 → ends at +1 not +2 (lost update).
- Fix: Use Firebase `transaction()`, `increment()`, or `serverTimestamp()`. For Apps Script use `LockService`.

**A2. Client-side ID generation (`lastId + 1`)**
- Pattern: `const newId = orders.length + 1` or `const newId = lastOrderId + 1`
- Risk: Two clients see the same `lastOrderId` → duplicate IDs.
- Fix: Firebase `push()` (auto-ID) or `transaction()` on the counter node. Never trust client.

**A3. Concurrent writes to same key**
- Pattern: Two code paths can `set()` the same Firebase node or localStorage key.
- Risk: Last-write-wins silently overwrites the other.
- Fix: Use `update()` with field-level paths, or merge logic, or a queue.

**A4. Multi-tab localStorage race**
- Pattern: Single-file PWA where user might open 2 tabs.
- Risk: Tab A reads, Tab B writes, Tab A writes back with stale data.
- Fix: Use `storage` event listener to invalidate cache, or use BroadcastChannel, or warn against multi-tab.

### Category B: State / Ordering

**A5. Missing `await` in async chain**
- Pattern: `function save() { writeToFirebase(); updateUI(); }` (no await on writeToFirebase)
- Risk: UI updates before write commits; on error, UI shows success.
- Fix: `await writeToFirebase()` before `updateUI()`. Or chain with `.then()`.

**A6. `Promise.all` when sequential is required**
- Pattern: `await Promise.all([writeA(), writeB()])` where B depends on A's result.
- Risk: Operations run concurrently when one depends on the other → null reference or wrong state.
- Fix: Sequential `await writeA(); await writeB();`.

**A7. Stale closure capturing old state**
- Pattern: `setTimeout(() => save(orderData), 1000)` where `orderData` is mutated before the timeout fires.
- Risk: Saves stale snapshot, not current state.
- Fix: Pass primitive values, not object references. Or read state fresh inside the callback.

### Category C: Partial Failure

**A8. Firebase write without `.catch()` or error handler**
- Pattern: `firebase.set(data)` with no error handling.
- Risk: Write fails silently, UI shows success, data is lost.
- Fix: Always `.then().catch()` or `try/await/catch`. (This is one of Tony's non-negotiable rules.)

**A9. Optimistic UI with no rollback**
- Pattern: Update UI first, then write to server. No rollback on failure.
- Risk: UI shows state that doesn't exist on server. User trusts a lie.
- Fix: Roll back UI on `.catch()`. Or write-first-then-UI for critical paths.

**A10. No `disconnect` handler for Firebase RTDB**
- Pattern: User goes offline mid-session; presence/lock data stays "online" forever.
- Risk: Locks held by dead clients block everyone.
- Fix: Use `onDisconnect().remove()` or `.set(null)` for ephemeral state.

### Category D: Multi-Actor

**A11. Auth state change mid-operation**
- Pattern: User session expires while async op is in flight.
- Risk: Operation succeeds with old token, or fails with confusing error.
- Fix: Re-check auth at write time; handle token expiry explicitly.

**A12. Admin override during user edit**
- Pattern: Admin can modify the same record a user is currently editing.
- Risk: User's save overwrites admin's change, or vice versa.
- Fix: Use a version field / `updatedAt` timestamp + conflict detection on save.

**A13. Same user, two devices**
- Pattern: User edits on phone and laptop simultaneously.
- Risk: Last-device-wins; the other device's work is lost.
- Fix: Real-time sync (Firebase RTDB listeners) or "your data changed elsewhere, reload" prompt.

### Audit output format

```
AUDIT of: <file or function>

Pattern matches:
- [A2] Line 47: client-side ID generation
  Risk: Order ID duplication when 2+ branches submit simultaneously
  Fix: Use firebase.database().ref('counters/orderId').transaction(...)

- [A8] Line 112: Firebase write without error handler
  Risk: Silent data loss
  Fix: Add .catch() with user-facing error toast

Pattern matches found: 2
Recommended priority: P0 (A2 is reproducible bug), P1 (A8 is data-loss risk)
```

---

## Tony's stack — known hotspots

These are the recurring places where these bugs show up in Tony's projects. When auditing or pre-flighting features in these files, weight these patterns higher:

### PuffStick FC Order System (Firebase RTDB, single-file vanilla)
- **Order ID generation** → A2 (must use `transaction()`)
- **Branch submits during admin edit** → A12
- **Branch goes offline mid-order, comes back** → A4 / A10
- **Telegram dispatcher in Cloudflare Worker** → A1 (idempotency: same order, two dispatches?)

### Pippa / Da'Neng Care (single-file, Firebase Auth + Firestore, localStorage cache)
- **Multi-tab on same device** → A4 (mother on phone + tablet both logging feed)
- **Offline-first feed log** → A4 / A10
- **Sleep timer running across tab close** → A7 (stale closure) / lifecycle
- **MoonOwlAI Gemini call mid-auth-refresh** → A11

### PuffStick POS (Google Apps Script + Sheets)
- **Concurrent receipt writes** → A1 (must use `LockService.getScriptLock()`)
- **POS ↔ FC Order schema sync** → A3 (two systems writing the same source of truth)

### PuffStick Production App
- **Production batch counters** → A2
- **Multiple factory devices logging same batch** → A3

---

## How to invoke this skill

**Pre-flight (default for new features):**
> "Run pre-flight for: adding VAT field to invoices"
> "I want to let branches edit their own pending orders — pre-flight first"

**Audit (for existing code):**
> "Audit index.html for concurrency bugs"
> "Audit the order submission function"
> "Run the hidden-bugs checklist against this Apps Script"

**Both (for an intermittent bug):**
> "Order IDs are duplicating sometimes — audit + propose fix with pre-flight"

---

## Anti-patterns this skill prevents (what AI agents do without it)

1. **เดา (guessing):** "It probably won't happen" — assume single-actor when there are many.
2. **ทำเกิน (over-engineering):** Add locks everywhere instead of identifying real concurrent paths.
3. **ลืม (forgetting):** Implement feature today, forget to check offline behavior, ship.
4. **โกหก (lying):** Say "I've handled concurrency" without naming the specific strategy.

This skill exists specifically to combat ลืม + เดา for concurrency. It forces explicit naming of strategy (Q2, Q6) rather than vague "should be fine."

---

## Reference: when atomic operations are required

You MUST use an atomic operation (not read-modify-write) for:

- Any counter (order ID, invoice number, batch number, queue position)
- Any "is this slot taken" check (table reservation, branch slot)
- Any balance / inventory decrement (stock, credit, points)
- Any "first one wins" semantic (claim, lock, assign)

**Firebase RTDB:** `ref.transaction(fn)` or `ref.set(firebase.database.ServerValue.increment(1))`
**Firestore:** `runTransaction()` or `FieldValue.increment()`
**Apps Script:** `LockService.getScriptLock()` with `waitLock(timeout)`
**localStorage:** No atomic op exists. Use Firebase as source of truth, localStorage as cache only.

---

## Final rule

If the user describes a feature and you find yourself thinking "this probably won't have concurrency issues" — that is the signal to **run pre-flight anyway**. The bugs this skill catches are the bugs you don't see coming.
