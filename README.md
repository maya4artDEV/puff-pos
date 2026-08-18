# PuffStick POS

Single-file daily-sales-summary tool for the PuffStick frozen-snack franchise (~20 branches). Vanilla HTML/JS, no build step. Backend = Google Apps Script + Google Sheets.

## Layout
```
index.html                 # PRODUCTION. Deploys as-is to GitHub Pages. Build stamp inside = version.
backend/owner/Code.gs      # Apps Script — Owner spreadsheet
backend/franchise/Code.gs  # Apps Script — Franchise spreadsheet
docs/                      # HANDOFF (live status + creds), state doc, conventions
.agents/rules/             # Antigravity workspace rules (always applied)
.agents/skills/            # Antigravity skills (loaded on demand)
AGENTS.md                  # Agent brief — read first
```

## Deploy
- POS: commit `index.html` → GitHub Pages serves it. Test with `?nocache=<n>` (Fastly CDN cache).
- Apps Script: paste `Code.gs` into the correct editor (Owner **or** Franchise), then *Manage deployments → edit → New version* (never "New deployment").

## Working with the agent
Antigravity reads `AGENTS.md` + `.agents/rules/` each session. Start POS tasks by pointing it at `docs/HANDOFF.md` for current status. Do not let it start the CRM without scoping (`.agents/rules/crm-scope.md`).

## ⚠️ Make this repo PRIVATE
`docs/HANDOFF.md` holds deploy exec URLs, Sheet IDs, and the Telegram chat ID. The Telegram **bot token** must stay in Apps Script only — never commit it. Prefer a private repo (GitHub Pages still works). See skill `backing-up-solo-projects`.
