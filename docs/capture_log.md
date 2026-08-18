# Capture Log — PuffStick POS

> Running journal for the compounding loop (Do → Capture → Upgrade). Append 2–4 lines per entry.
> This is **history**, not enforcement. When a capture recurs or is load-bearing, **graduate** it into `.agents/rules/` so the agent enforces it every session. Mark it `→ graduated` here.
> Newest on top. This file is read on demand, not every session.

---

## 2026-08-18

**Task 3 (read-path merge removal) — grep confirms.** หลังลบ merge block ใน `prefetchCloudState`, grep ยืนยันว่า `doReplace`/`cScore`/`lScore` = 0 hits, `activityScore` เหลือแค่ใน `migrateBranchKeys`. ตัวบั๊กสำคัญที่แก้มา 5 รอบไม่หาย ตอนนี้ต้นตอฝั่ง client ถูกตัดออกแล้ว รอ Task 5 ปิดฝั่ง server. Playwright test ที่ agent เขียนมี flaw (re-implement spec แทนที่จะเรียก function จริง) — grep audit จับได้แทน.
- Lesson: static grep audit หลัง surgical edit สำคัญไม่แพ้ automated test
- → keep as history (ยังไม่ graduate เพราะบทเรียนเฉพาะ merge fix)

**`el()` + `onclick: function(){}` = ปุ่มตายเงียบ.** `el()` ไม่มี case สำหรับ `onclick` → function value ตกไป `setAttribute("onclick", fn)` → stringify หลุด closure → ปุ่ม throw ตอนคลิก (`opt is not defined`) โดยไม่มี error โชว์ในหน้าจอ
- Fix: `data-*` attribute + delegated `addEventListener` บน container
- → graduated → `.agents/rules/code-conventions.md` (event handlers via `el()`)

**Static check ไม่ใช่การเทส event handler.** `node --check` / brace-balance ยืนยันแค่ว่า parse ผ่าน ไม่ได้ยืนยันว่าคลิกแล้วทำงาน. interactive element ต้องคลิกจริงในเบราว์เซอร์ถึงถือว่า task ผ่าน
- → reinforces: browser click test เป็น done-criteria ของทุก interactive element ที่สร้างผ่าน `el()` — ไม่ใช่ optional

## 2026-08-18

**`git amend` does not un-expose a pushed secret on a public repo.** After blanking the token and force-pushing, `main` was clean — but the original commit `0a4ab45` was still fetchable by SHA on GitHub and still served the live token (verified via raw.githubusercontent, HTTP 200). The repo was public the whole time.
- Wrong assumption (the agent's): clean `git log` = secret gone. It isn't — GitHub retains dangling commits by SHA; you can't self-purge them.
- Fix: **rotating the secret is the only real remediation.** Repo cleanup is cosmetic once something has been pushed public. Also flip the repo to private to stop exposing HANDOFF exec URLs / Sheet IDs.
- → reinforces `.agents/rules/backend-appsscript.md` "Secrets — never commit" (prevention is the only cheap option; cleanup after a public push is not).

**Secret committed via copied file.** Copied the user's `Code_Owner_v7.gs` / `Code_Franchise_v7.gs` into `backend/` verbatim → the live `TG_BOT_TOKEN` was committed and force-pushed to GitHub.
- Wrong assumption: a deny-rule against committing secrets covers files I *write*, but I applied it to nothing I *copied*.
- Fix: strip secrets from any file before committing it, copied or not. Token rotated in BotFather; blanked in repo.
- → graduated → `.agents/rules/backend-appsscript.md` ("Secrets — never commit").

**File-number bumping vs git SSOT.** The chat-era habit of bumping `puff-vN.html` every delivery existed only because there was no version control.
- Decision: `index.html` is the single deployable; version = in-file build stamp + git history. No parallel `puff-vN.html` in the repo.
- → reflected in `.agents/rules/deploy-and-production.md`.

**"pushed" ≠ "live".** After a GitHub Pages push, the build stamp must be verified on the live URL with `?nocache=` before calling deploy done (Fastly cache + Pages build delay).
- → reflected in the deploy runbook (Gate 4).
