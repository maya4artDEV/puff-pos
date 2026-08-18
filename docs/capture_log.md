# Capture Log — PuffStick POS

> Running journal for the compounding loop (Do → Capture → Upgrade). Append 2–4 lines per entry.
> This is **history**, not enforcement. When a capture recurs or is load-bearing, **graduate** it into `.agents/rules/` so the agent enforces it every session. Mark it `→ graduated` here.
> Newest on top. This file is read on demand, not every session.

---

## 2026-08-18

**`el()` + `onclick: function(){}` = a dead button, silently.** `el()` has no special case for `onclick`, so a function value falls through to `setAttribute("onclick", fn)`, which stringifies the function and loses its closure (`opt is not defined` on click). The agent shipped this and passed it, because brace-balance + grep only prove syntax, not behavior.
- Fix: `data-mode` attribute + one delegated `addEventListener` on the container (matches the file's `onclick="..."`-string convention and Tony's stated preference).
- → graduated → `.agents/rules/code-conventions.md` (event handlers via `el()`).

**Static checks are not a passing test for event handlers.** `node --check` / brace-balance verify the code parses; they do not verify a click does anything. An event handler is only "done" after a real click in a browser.
- → reinforces the workflow: for any interactive element, a browser click test is part of the task's done-criteria, not optional.

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
