# HANDOFF — PuffStick POS v2 (for new chat) · updated 2026-09-18

Supersedes `HANDOFF-puffstick-pos.md`. Paste this in a fresh chat (+ attach files noted) to resume without re-explaining.

Repo `maya4artDEV/puff-pos` · branch `main` · live `https://maya4artdev.github.io/puff-pos/`
Two backends: **OWNER** `.gs` + **FRANCHISE** `.gs` (separate exec URLs). Routing in `getSyncURL`: branch is a preset code **or** starts with capital `E` → OWNER; everything else → FRANCHISE.
Exec URLs (embedded in the client): OWNER `AKfycbxMbd0YD2KpUjk0DMYsLdVxGEj1BeCJchv12QmKdN454kMF5BCsIpnsipoTaAWQMOoD` · FRANCHISE `AKfycbzeHh3ouj782znH-gQemvoH733fQjrQZPWFiesTZU3Hzum4coiEWb2ZAwoC1kPPFM-NDQ` (append `/exec`).

---

## ▶️ RECOMMENDED NEXT ACTION
**Login latency fix** — the one operational pain (branches with weak signal can't log in).
Root cause (measured, not guessed): Apps Script backend **works but is slow, ~2–4 s per call**. Login makes **2 sequential calls** — `branch_auth` POST (L4301, **no timeout**) then `prefetchCloudState` state_latest (L6280, 6 s cap). `exec` redirect occasionally returns an **HTML interstitial** instead of JSON → browser `.json()` throws → "เชื่อมต่อไม่ได้". On weak-signal branches (WNY-04 บ้านใหญ่วังน้อย, บางปะอิน) the 2–4 s calls balloon → hang/fail. **Not** a data-size issue (WNY-04 auth `ok:true` 2 s, state 3 KB), **not** from build 0007.
Proposed fix (client only): (a) `AbortController` timeout on `branch_auth` (~12 s) + clear retry message; (b) make `prefetchCloudState` non-blocking — let login proceed, load cloud state in background; (c) handle non-JSON responses gracefully (retry, don't hard-fail). Needs a SPEC→PLAN + MD5 target.

---

## ✅ DONE — build 0007 (pushed to `main`, live)
Client `index.html` — **LF, no BOM**, ES5, DOM via `el()`, build stamp ×3 (meta ~L12, title ~L13, `#buildVer`).
MD5 progression: `0004 d5efa714` → `0005 cd04a25c` → `0006 4ad270da` → **`0007 135e78d6a4bfc15dd5a4de5932e44d4a`** (live).

| Work | Notes |
|---|---|
| Issue 1 count-first close-day | front-desk revenue = `fry_out − counted − damaged − free − deliveryPieces`; delivery net separate (no double); counts persisted in `S.counted`; blocks close until counted; tapped = reference. **Device-tested** (count-complete → close allowed; money-short records a discrepancy, allowed by design). |
| viewer-mode toast | 4 write handlers (`saveFry/submitSell/saveDelivery/submitGiftSale`) now toast instead of silent return in viewer mode. `queueCloudSync` stays silent (background). |
| Part B — sync locked-drop | `flushSyncQueue` drops queue items on `d.locked` (was: retried forever). |
| FG-LAT chocolate | core F chocolate `code` `FG-CHO`→`FG-LAT` (**code only**, `id:"CHO"` kept — full id rename would orphan live stock/sales/counted). |
| home shortcut cards | `.sc-row` flex-scroll → **grid 3 cols** (2×3), no horizontal slide, vertical scroll intact. `.qcard` dropped fixed 130px. Drag-reorder still works. |
| Server close-lock (both `.gs`) | `state_save` rejects overwrite when stored `is_closed===true` (`{ok:false,locked:true}`); closing save still passes (first-close-wins). **Deployed + tested** both scripts. |
| Feature B — franchise `gift_sale` | **live** (confirmed in franchise editor). |

### Backend `.gs` (both **CRLF + UTF-8 BOM**)
- OWNER: `052187c2…` → after close-lock **`3967f4cb63421f3a62194a1173c78921`** (deployed).
- FRANCHISE: repo `73ca3c…` (has gift_sale) → after close-lock **`a68a27133d5bf2925bbbc69e6b0f7dc4`** (deployed; has gift_sale + close-lock + branch_auth).
- `TG_BOT_TOKEN` is a **code const**, `""` in repo, real value **only in the Apps Script editor** → **`clasp push` would wipe it → Telegram breaks.** Deploy `.gs` manually (paste in editor) or re-set the token after push. `TG_CHAT_ID` franchise = `5566010745`.

---

## ⏳ PENDING (Tony-side / verify — not blocking)
1. **T5 proper test:** fry something → intentionally skip a leftover count → tap ปิดวัน → expect toast "นับเหลือหน้าตู้ให้ครบทุกไส้ก่อนปิดวัน". (Not yet tested — earlier test had complete counts.)
2. **Close confirm dialog:** does the `confirm("ยืนยันปิดวันนี้?")` (L5595) actually appear in the in-app browser? If suppressed → replace with a custom modal.
3. **Rotate WNY-04 branch PIN** — leaked in a screenshot (like HQ_PIN before). OWNER script BranchAuth.
4. **BUG A (non-bug):** "นำเงินออกระหว่างวัน" is a read-only auto-total; add withdrawals via "+ เพิ่มรายการจ่ายออก". Optional UX: label it "(รวมอัตโนมัติ)".

---

## 🧊 BACKLOG / QUEUE (own SPEC/PLAN each; pick by impact)
| item | effort | impact | ref |
|---|---|---|---|
| **login latency fix** | med | 🔴 high (operational) | see NEXT ACTION above |
| **Issue 2 — per-branch custom fry fillings** | large | 🟡 med | `SPEC-issue2-custom-fillings.md` |
| **email report direct-send** (Apps Script MailApp — backend generates + mails; no export→attach) | sm-med | 🟡 med | — |
| **merge Delivery sheet into Sales sheet** (export code) | sm | 🟢 low (cosmetic) | — |
| **Issue 3 Tier 2 — same-device late-close** | large | 🟡 med | `SPEC-issue3-late-close.md` |

**Issue 2 essentials:** core `F` already `{id:3char, code:FG-XXX}` where id = code minus `FG-`; no filling-id length assumption anywhere. Approach 2A staged: Stage 1 `getFillings() = F.concat(S.customFillings||[])` + convert **42 `F`-iteration sites** (incl. Issue-1 count sites 5416/5472/5492 + export) — behavior-preserving (empty custom → MD5-identical) — then Stage 2 add-modal **picklist** of the 4 new FG (`FG-CUT`/`FG-GDN`/`FG-GLD`/`FG-MDK`; auto-dedup vs core by id), then Stage 3 carry/sync/export (carry like `gift_catalog`). FG-LAT already resolved (chocolate). Sequence **after** 0007 is confirmed stable in the field.

**Issue 3 Tier 2 essentials:** builds on the shipped close-lock (Tier 1). localStorage picker of unclosed days (N days), **fix `queueCloudSync(currentBranch, todayISO(), S)` at L4055 to key off `S.date`**, audit flags (`closedLate/daysLate/closedBy`) + HQ Telegram on late close. Tier 3 (cross-device via cloud) deferred.

---

## GUARDRAILS / workflow (keep)
- **NOVA pre-validates** the exact edit + computes the target MD5 in a sandbox, then hands Tony **ONE self-verifying PowerShell block** (precheck baseline MD5 → `str_replace` → verify target MD5, prints real MD5). No Antigravity round-trip. **NOVA still independently verifies any uploaded file's MD5 — never trust a report.**
- **PowerShell .NET file ops:** `Resolve-Path` → absolute path before `[System.IO.File]::ReadAllText/WriteAllText` (else it uses process CWD = `system32`). `index.html` → `UTF8Encoding($false)` (no BOM, LF). `.gs` → `UTF8Encoding($true)` (BOM, CRLF). Use **ASCII-only anchors** for stamp edits (avoid the `·` middle-dot).
- `index.html`: bump build stamp ×3 on every client change; `el()` special-cases only `cls/txt/html/css`; events via `.onclick`/closure, never `onclick:` attr.
- `.gs`: two scripts, always say which (owner/franchise); token hazard above.
- **Context Hub:** `ch-find "<topic>" -Project puff-pos` at session start; `ch-save "<durable learning>" -Project puff-pos -Tags …` on durable decisions. Endpoint occasionally DNS-hiccups → `Resolve-DnsName context-hub.92foodlimited.workers.dev` to check; re-run the ch-save. Never capture secrets/PINs/tokens.

## Session artifacts (re-attach the relevant one when picking an item)
`SPEC-issue2-custom-fillings.md` · `SPEC-issue3-late-close.md` · `PLAN-viewer-toast.md` · `PLAN-tier1-closelock.md`

## Suggested first message in the new chat
> "อ่าน HANDOFF-puffstick-pos-v2.md (แนบ) + index.html (build 0007, MD5 135e78d6). งานถัดไป: login latency fix — เขียน SPEC→PLAN (client only): timeout `branch_auth`, prefetch แบบ non-blocking, handle non-JSON. แล้วค่อยไล่คิว Issue 2 / email report / Issue 3 Tier 2."
