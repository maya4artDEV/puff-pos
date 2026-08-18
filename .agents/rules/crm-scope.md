# Rule: CRM — scoping mode (not built)

CRM does not exist yet. **Do not start coding it.** Scope first, confirm with Tony.

## Already decided (from HANDOFF / state doc)
- Purpose: **Branch Directory + Contract Tracker** for an HQ team of 2–5, desktop browser.
- Contract expiry shows as a **badge** on the row — no separate alert page.
- Backend: Google Sheets (match the POS stack where it fits — vanilla HTML/JS, no framework).
- Cut from MVP: Notes, franchise sales tracking (no data source yet).

## When Tony says "start the CRM"
1. Run skill `brainstorming` → confirm target user, primary use case, integrations, MVP features.
2. Then `writing-feature-specs` → `writing-plans` → `executing-plans`.
3. If it will hold customer data or drive LINE/SMS broadcast → apply `complying-with-thai-pdpa` from the start (consent, right-to-access/delete, data region).
4. Keep MVP minimal. No overpacked feature list.
5. Decide standalone file vs. shared-with-POS **with Tony** — do not assume.

## Do not
- Do not blend CRM schema with POS or Order IDs.
- Do not pick a stack other than the POS one without asking.
