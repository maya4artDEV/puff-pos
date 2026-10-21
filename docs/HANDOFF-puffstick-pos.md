# HANDOFF — PuffStick POS (for new chat) · updated 2026-08-25

Supersedes the earlier handoff. Paste this + attach the files noted, in a fresh chat, to resume without re-explaining.

Repo `maya4artDEV/puff-pos` · branch `main` · live `https://maya4artdev.github.io/puff-pos/`
Two backends: **OWNER** `.gs` + **FRANCHISE** `.gs` (separate exec URLs). Routing by `getSyncURL`: branch is a preset owner code **or** starts with capital `E` → OWNER; everything else → FRANCHISE.

---

## ▶️ NEXT ACTION (in flight)
**Issue 1 — count-first close-day money fix. PLAN pre-validated, awaiting Antigravity.**
- File: `PLAN-issue1-countfirst.md` (attach it).
- Baseline `index.html` = `72701e371a7a9a24ea50dda2ac10ba3e` (build 0003). Target after Issue 1 = **`d5efa714b30321e74b7d62f187fe0cba`** (build 0004).
- Command to Antigravity: execute I1→I5 exact `str_replace`, `index.html` only, report MD5 (must be `d5efa714…`).
- Then NOVA audits MD5 independently → Tony tests on device (esp. **T3** tap+count no double, **T4** delivery not doubled) → push to GitHub Pages. Client-only, no `.gs`.

**Why:** `calcClose` built `expected` from tapped `S.sales`; branches rarely tap (customers won't wait) → false "เกิน" daily. Fix derives front-desk revenue from the physical count (`fry_out − counted − damaged − free − deliveryPieces`), keeps delivery net separate (no double), persists counts in new `S.counted` (was DOM-only), blocks close until counted, shows tapped as reference only.

---

## ✅ DONE (deployed unless noted), current live MD5
| Work | State |
|---|---|
| branch-access (per-branch PIN) | deployed + pushed |
| durian DUR-001 (฿45) | deployed |
| toast z-index fix | pushed |
| Feature A — recent-branches chip | pushed (client-only) |
| Feature B — franchise `gift_sale` | **committed in repo, NOT deployed** (see below) |
| Staff guide v3.1 (PDF+docx) | delivered |

- `index.html` live = `72701e371a7a9a24ea50dda2ac10ba3e` (build 20260825.0003, **LF**)
- owner `.gs` = `052187c23d4770b3a1c6d373c601f230` (**CRLF**)
- franchise `.gs` **live** = `9d486696529d73e140eaaa0b7fc1fa04` (has `branch_auth`, **no `gift_sale` yet**)
- franchise `.gs` **repo** (with `gift_sale`) = `73ca3c633188a6ce447df1b467697eec` — deploy pending

---

## ⏳ PENDING (Tony-side, not code)
1. **Deploy Feature B** — FRANCHISE `.gs` → Deploy → New version (franchise only). Test: gift row in franchise sheet + Telegram 🎁 fires + existing handlers unaffected.
2. **Verify on device:** branch-access T1–T10 (only T2 wrong-PIN confirmed), chip T-A1..A6.
3. **Rotate `HQ_PIN`** — value `2529` leaked in a screenshot; change in OWNER script props.

---

## 🔴 OPEN BUG (needs on-site data)
Event branch: **fry-save button does nothing / "ปุ่มกดไม่ติด"** → can't fry → can't sell. Seen when logged in as `PuffStick_CM_ซีคอนศรีนครินทร์` (wrong format).
- **Ruled out** (code guards them): missing `DUR` stock key (`setBranch` backfills; `getStockForState` guards), `S=null` from fetch fail (6s timeout+callback), localStorage key corruption (`safeBranch` keeps Thai+`\w`).
- **Need:** JS console error OR the exact branch string typed (possible hidden char) from the affected device — Tony couldn't get it (staff in another province).
- **Workaround given:** logout → re-login with a name starting `E-` → receive stock → fry → sell.
- **Naming rule (authoritative):** event branch names MUST start with capital `E` (`getSyncURL`: `branch.charAt(0) === "E"`). Otherwise routes to FRANCHISE backend.

---

## 🧊 BACKLOG (own SPEC/chat each)
**Issue 2 — per-branch custom fry fillings.** Branch adds its own filling + sell price, in the **fry→sell** stock pipeline (not the gift pipeline). Decisions locked: per-branch (2-D1); synced + day-carry-over like gift catalog (2-D2); **IDs come from the production team, staff cannot set them** (2-D3, Tony coordinating); edit/price-change allowed, **no delete → hide** (2-D4); appear in export + Telegram (2-D5). Approach **2A**: add `S.customFillings`, introduce `getFillings() = F.concat(S.customFillings)`, convert all 12+ `F.forEach`/`F.map` sites, staged (behavior-preserving refactor first, then add-modal, then carry/sync/export). Blocker: needs the production team's filling-ID list. Ref: `DESIGN-reconcile-and-custom-fillings.md`.

**Issue 3 — business-day cutoff / late close.** Event branches finishing after midnight (clear ~2am) can't reconcile the right day: app cuts day at midnight (`todayISO` = calendar date, Bangkok), only "today" is editable, past days view-only. Options: A cutoff offset (~5am; biggest blast radius), B editable past day, C nudge on open ("ปิดวันเมื่อวานต่อไหม?"). **Rec: C.** Interim (no code): keep app open / don't reload until close is done → in-memory state stays on the correct day.

---

## GUARDRAILS / workflow (keep)
- **NOVA** writes SPEC→PLAN with locally pre-validated code + MD5 target; **Antigravity** executes exact `str_replace`; **NOVA re-verifies the uploaded file's MD5 independently** — never trust the report. Antigravity has twice freestyled (rewrote the plan / revert-rebuild baseline); outputs were correct but only caught by the independent MD5 check.
- `el()` special-cases only `cls/txt/html/css`. Event handlers via `.onclick = closure` (IIFE per item), **never** `onclick:` in attrs.
- `index.html`: **LF**, ES5 only (`var`/`function(){}`), DOM via `el()`, bump build stamp ×3 (meta ~L12, title ~L13, `#buildVer` ~L3456) on every client change.
- `.gs`: **CRLF**, `TG_BOT_TOKEN=""` in repo (real token lives in the Apps Script editor only). Two scripts — always say which (owner/franchise).
- Before audit, MD5 the file; if it still equals the OLD baseline the file wasn't saved (Ctrl+S) → reject.

## Session artifacts (re-attach as needed)
`PLAN-issue1-countfirst.md` · `SPEC-issue1-countfirst.md` · `DESIGN-reconcile-and-custom-fillings.md` · `PLAN-B-franchise-giftsale.md` · `คู่มือพนักงาน-PuffStick-v3.1.(pdf|docx)`

## Suggested first message in the new chat
> "อ่าน HANDOFF-puffstick-pos.md (แนบ) + index.html (build 0003, MD5 72701e37). งานถัดไป: ให้ Antigravity รัน PLAN-issue1-countfirst.md (count-first ปิดวัน, target MD5 d5efa714) แล้ว audit. หลังจากนั้นค่อยว่าเรื่อง deploy Feature B, bug ปุ่มทอด, และ Issue 2/3."
