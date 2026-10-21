# HANDOFF — PuffStick POS v3 (for new chat) · updated 2026-09-18

Supersedes `HANDOFF-puffstick-pos-v2.md`. Paste this in a fresh chat (+ attach files noted) to resume without re-explaining.

Repo `maya4artDEV/puff-pos` · branch `main` · live `https://maya4artdev.github.io/puff-pos/`
Two backends: **OWNER** `.gs` + **FRANCHISE** `.gs` (separate exec URLs). Routing in `getSyncURL`: branch is a preset code **or** starts with capital `E` → OWNER; everything else → FRANCHISE.
Exec URLs (embedded in the client): OWNER `AKfycbxMbd0YD2KpUjk0DMYsLdVxGEj1BeCJchv12QmKdN454kMF5BCsIpnsipoTaAWQMOoD` · FRANCHISE `AKfycbzeHh3ouj782znH-gQemvoH733fQjrQZPWFiesTZU3Hzum4coiEWb2ZAwoC1kPPFM-NDQ` (append `/exec`).

---

## ▶️ RECOMMENDED NEXT ACTION
Pick by impact from the queue below. Highest ROI: **email report direct-send** (small-med effort, med impact, no new schema). If preferring a ready-to-resume item, **Issue 3 business-day** already has a written SPEC blocked only on 3 Tony decisions (`SPEC-issue3-business-day.md`, rows 3-D2/3-D3/3-D5). Each queue item gets its own SPEC→PLAN + MD5 target before code.

---

## ✅ DONE — build 0008 (pushed to `main`, live, field-tested)
**Login latency / weak-signal hang fix** — client-only, `SPEC-login-latency.md` → `PLAN-login-latency.md`.
Client `index.html` — **LF, no BOM**, ES5, DOM via `el()`, build stamp ×3 (meta ~L12, title ~L13, `#buildVer` ~L3502).
MD5 progression: `0004 d5efa714` → `0005 cd04a25c` → `0006 4ad270da` → `0007 135e78d6a4bfc15dd5a4de5932e44d4a` → **`0008 125a4aeb41ad71ab0fdcac22619ea0bf`** (live).
Commits: login fix `3800082` · LF-pin `851735b`.

| Work | Notes |
|---|---|
| **New ES5 helper `fetchJSON(url, opts, timeoutMs)`** | inserted before `doLogin`. `AbortController` (feature-detected, LG-D5), 12 s timer → `abort()` + reject `"timeout"`; reads `r.text()` then `JSON.parse` — non-JSON HTML interstitial → reject `"nonjson"` instead of hard-throw. Single source of truth for timed, JSON-safe fetch. |
| **`finishLogin` non-blocking** | transition into `mainApp` fires immediately (setBranch gives valid local `S`); `prefetchCloudState` moved to end as **background**, callback reloads `S` + re-renders current tab — mirrors `refreshFromCloud`. No more blocking on cloud (was: up to 6 s). |
| **`branch_auth` retry-once** | `onAuthOk(d)` (wrong PIN = JSON `{ok:false}`, unchanged msg "รหัสผ่านสาขาไม่ถูกต้อง") + `authAttempt(isRetry)` via `fetchJSON(...,12000)`; transient (timeout/non-JSON/network) → **1 auto-retry** → "เชื่อมต่อช้า ลองใหม่อีกครั้ง" + button re-enabled (no stuck spinner). Wrong PIN never enters retry path. |
| **build stamp** | `20260825.0007` → `20260918.0008` ×3. |
| **`.gitattributes`** | `index.html -text` — pins to LF, blocks git CRLF conversion (was warning on push). |
| Tests | **Local L1/L2/L4 PASS** (BPI-05 บางปะอิน ฿625, WNY-04 บ้านใหญ่วังน้อย fresh, wrong-PIN no-loop). **L3 field-test PASS** (weak-signal branch on mobile 4G). |

**Scope was login-only (LG-D4):** `prefetchCloudState` internals (L6263) untouched (already self-caps 6 s + `.catch(finish)` graceful on non-JSON; made non-blocking by the `finishLogin` restructure). Background/HQ `.json()` sites (L6196 sync, ~L6404/6455 HQ) untouched — same helper can wire them later as a low-risk fast-follow.

### Backend `.gs` (both **CRLF + UTF-8 BOM**) — unchanged this session
- OWNER: close-lock **`3967f4cb63421f3a62194a1173c78921`** (deployed).
- FRANCHISE: close-lock **`a68a27133d5bf2925bbbc69e6b0f7dc4`** (deployed; has gift_sale + close-lock + branch_auth).
- `TG_BOT_TOKEN` is a **code const**, `""` in repo (verified L7 both scripts = empty), real value **only in the Apps Script editor** → **`clasp push` / `git add .` would risk wiping/leaking it → deploy `.gs` manually (paste in editor).** `TG_CHAT_ID` franchise = `5566010745`.

---

## ⏳ PENDING (Tony-side / verify — not blocking)
1. **Rotate WNY-04 branch PIN** — leaked in a screenshot (like HQ_PIN before); also visible again during 0008 login testing. OWNER script BranchAuth.
2. **T5 close-day test:** fry → skip a leftover count → ปิดวัน → expect "นับเหลือหน้าตู้ให้ครบทุกไส้ก่อนปิดวัน".
3. **Close confirm dialog:** does `confirm("ยืนยันปิดวันนี้?")` (~L5595) appear in the in-app browser? If suppressed → custom modal.
4. **BUG A (non-bug):** "นำเงินออกระหว่างวัน" is a read-only auto-total; add via "+ เพิ่มรายการจ่ายออก". Optional UX: label "(รวมอัตโนมัติ)".

---

## 🧊 BACKLOG / QUEUE (own SPEC/PLAN each; pick by impact)
| item | effort | impact | ref |
|---|---|---|---|
| **email report direct-send** (Apps Script MailApp — backend generates + mails; no export→attach) | sm-med | 🟡 med | — |
| **Issue 2 — per-branch custom fry fillings** | large | 🟡 med | `SPEC-issue2-custom-fillings.md` |
| **Issue 3 — business-day / late-close** (Rec C nudge on open) | large | 🟡 med | `SPEC-issue3-business-day.md` (SPEC ready, 3 decisions pending) |
| **merge Delivery sheet into Sales sheet** (export code) | sm | 🟢 low | — |

**Issue 2 essentials:** core `F` already `{id:3char, code:FG-XXX}`; no filling-id length assumption. Approach 2A staged: Stage 1 `getFillings()=F.concat(S.customFillings||[])` + convert **42 `F`-iteration sites** (behavior-preserving, empty custom → MD5-identical) → Stage 2 add-modal picklist (`FG-CUT`/`FG-GDN`/`FG-GLD`/`FG-MDK`; dedup vs core) → Stage 3 carry/sync/export (carry like `gift_catalog`). Sequence after 0008 confirmed stable.

**Issue 3 essentials:** `SPEC-issue3-business-day.md` grounded on 0004 — **re-audit line anchors on 0008 first** (drift + `todayISO()` now 9 call sites vs 5 in the SPEC's list). Riskiest edit = the `queueCloudSync(currentBranch, todayISO(), S)` hardcode (SPEC L4055 → verify current line on 0008) must become `S.date`-aware. Nudge-on-open design; close/sync must key off `S.date` not `todayISO()`.

---

## GUARDRAILS / workflow (keep)
- **NOVA pre-validates** the exact edit + computes target MD5 in a sandbox (copy file, apply edits, `node --check` extracted JS, md5sum), then hands Tony **ONE self-verifying block**. This session used **file-swap gated on MD5** (avoids embedding Thai multi-line strings in PowerShell = the escaping bug class): present the finished `index.html`, Tony's PowerShell asserts live=baseline → finds the downloaded file by target MD5 → backup → swap → asserts live=target. MD5 gate stops before touching live if anything is off. **NOVA still independently verifies any uploaded file's MD5 — never trust a report.**
- **⚠️ Re-verify local `index.html` MD5 before the next edit** — do NOT assume it's still `125a4aeb`. `.gitattributes` was added after 0008 shipped; confirm `(Get-FileHash index.html -Algorithm MD5)` = `125a4aeb…` at the start of the next code task; if git renormalized it, re-sync from `origin/main` first.
- **Download-to-disk gotcha:** browser may save chat artifacts as `index (1).html` or reuse a stale `Downloads\index.html`. Find the target by MD5, not by filename (`Get-ChildItem … | Where-Object { hash -eq $TGT }`).
- **PowerShell .NET file ops:** `Resolve-Path` → absolute path before `[System.IO.File]::ReadAllText/WriteAllText` (else CWD = system32). `index.html` → `UTF8Encoding($false)` (no BOM, LF). `.gs` → `UTF8Encoding($true)` (BOM, CRLF). ASCII-only anchors for stamp edits (avoid the `·` middle-dot).
- `index.html`: bump build stamp ×3 on every client change; `el()` special-cases only `cls/txt/html/css`; events via `.onclick`/closure, never `onclick:` attr.
- **`.gs`: two scripts, always say which (owner/franchise); token hazard above — never `git add .` / `git commit -a`; deny-list (`git push`, `firebase`, `npm install`) needs explicit go-ahead.**
- **Context Hub:** `ch-find "<topic>" -Project puff-pos` at session start; `ch-save "<durable learning>" -Project puff-pos -Tags …` on durable decisions. Endpoint occasionally DNS-hiccups → `Resolve-DnsName context-hub.92foodlimited.workers.dev`; re-run. Never capture secrets/PINs/tokens.

## Session artifacts (re-attach the relevant one when picking an item)
`SPEC-login-latency.md` · `PLAN-login-latency.md` (0008) · `SPEC-issue2-custom-fillings.md` · `SPEC-issue3-business-day.md` · `PLAN-viewer-toast.md` · `PLAN-tier1-closelock.md`

## Suggested first message in the new chat
> "อ่าน HANDOFF-puffstick-pos-v3.md (แนบ) + index.html (build 0008, MD5 125a4aeb). งานถัดไป: **[email report / Issue 2 / Issue 3]** — เขียน SPEC→PLAN. ก่อนแก้: re-verify local MD5 = 125a4aeb ก่อน (อย่า assume)."
