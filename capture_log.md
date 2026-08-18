# Capture Log — PuffStick POS

> Running journal for the compounding loop (Do → Capture → Upgrade). Append 2–4 lines per entry.
> This is **history**, not enforcement. When a capture recurs or is load-bearing, **graduate** it into `.agents/rules/` so the agent enforces it every session. Mark it `→ graduated` here.
> Newest on top. This file is read on demand, not every session.

---

## 2026-08-18

**Secret committed via copied file.** Copied the user's `Code_Owner_v7.gs` / `Code_Franchise_v7.gs` into `backend/` verbatim → the live `TG_BOT_TOKEN` was committed and force-pushed to GitHub.
- Wrong assumption: a deny-rule against committing secrets covers files I *write*, but I applied it to nothing I *copied*.
- Fix: strip secrets from any file before committing it, copied or not. Token rotated in BotFather; blanked in repo.
- → graduated → `.agents/rules/backend-appsscript.md` ("Secrets — never commit").

**File-number bumping vs git SSOT.** The chat-era habit of bumping `puff-vN.html` every delivery existed only because there was no version control.
- Decision: `index.html` is the single deployable; version = in-file build stamp + git history. No parallel `puff-vN.html` in the repo.
- → reflected in `.agents/rules/deploy-and-production.md`.

**"pushed" ≠ "live".** After a GitHub Pages push, the build stamp must be verified on the live URL with `?nocache=` before calling deploy done (Fastly cache + Pages build delay).
- → reflected in the deploy runbook (Gate 4).
