
## 2026-09-20 — Escalated on proxy signals before checking real values

**Mistake:** Twice concluded from an indirect check before opening the actual value it pointed to.
1. MD5 mismatch -> started treating as a problem before running `diff` (was a 1-line dropped comment, zero impact).
2. grep/Select-String returned Count=6 on TG_|bot|token|chat_id -> escalated to a token-leak incident (told Tony to rotate the bot token, drafted history-scrub commands) before opening the file. Reality: TG_BOT_TOKEN = "" -- the 6 matches were variable names + the "never commit" comment. No token leaked.

**Root cause:** Treated a proxy signal (match count, MD5 diff, exit code, row count) as ground truth. grep counting a *pattern* is not proof a *value* exists; an MD5 diff means "different", not "broken".

**Rule going forward:**
- Before escalating or concluding from any proxy signal, open the concrete value the signal points to.
- Security specifically: match-count > 0 means "possible -- go look", not "leaked". Severity claim must match evidence in hand.
- Cheapest correct next step after a surprising signal is almost always diff / open-the-file, not a conclusion.
