# Rule: deploy & production safety

## Deploy target
- `index.html` at repo root deploys to GitHub Pages: https://maya4artdev.github.io/puff-pos/
- Repo: `maya4artDEV/puff-pos`. The served file is `index.html` at root — keep it there.
- **`index.html` is production.** Any commit to it can reach real branches. Treat every edit as a live change.

## Version = build stamp + git, NOT filenames
- Do **not** create `puff-v13.html`, `puff-v14.html`, etc. in this repo. The chat-era "bump the filename each delivery" habit was a workaround for having no version control. Here, git history + the in-file build stamp are the version. Keeping parallel `puff-vN.html` files violates single-source-of-truth.
- On a real change: edit `index.html`, bump the build stamp (format `YYYYMMDD.HHMM`), commit with a clear English message.

## Cache gotchas (verified, not theoretical)
- GitHub Pages sits behind a Fastly CDN cache, separate from the browser cache. After deploy, test with `?nocache=<n>` to bypass.
- Staff on Add-to-Home-Screen / WebClip shortcuts can hold a stale build. If the build stamp on screen doesn't change: delete the shortcut and re-add. This is known behavior, not a bug.
- **Self-audit before blaming a stale client:** `grep` the build stamp in the file you actually shipped first.

## Apps Script deploy (manual, by Tony)
- Owner and Franchise are two separate scripts with two separate exec URLs (in `docs/HANDOFF.md`).
- Redeploy path is *Manage deployments → ✏️ edit → New version* — never "New deployment" (that changes the URL and breaks the app).

## Secrets
- Telegram bot token lives in Apps Script only. Never commit it here.
- Deploy exec URLs and Sheet IDs are already embedded in the shipped `index.html` (the app calls them), so they are effectively public. That does **not** make the bot token public — keep it out of the repo.
