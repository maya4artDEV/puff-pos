# Rule: Apps Script backend

Two separate scripts. **State which one you are editing, every time.**

- `backend/owner/Code.gs` — Owner spreadsheet (Sheet ID in HANDOFF).
- `backend/franchise/Code.gs` — Franchise spreadsheet (Sheet ID in HANDOFF).

## Do not break live contracts
- Event types in use: `sale`, `fry`, `gift_sale`, and state sync `state_save` / `state_get` / `state_list` / `state_latest`. Do not rename or repurpose them.
- Do not change Sheet column structure where live data already exists.
- Merge policy (v7): the "richer" state wins — `activityScore` = count of sales/fry/stock logs + total stock pieces; timestamp only breaks ties. `scoreState` on the server rejects a `state_save` whose score is lower than what's stored (empty-state poisoning guard). Enforced on both client and server — keep them in sync.

## Known gaps (do not silently "fix")
- Franchise script has **no** `gift_sale` handler yet.
- Franchise `TG_CHAT_ID` is a placeholder. Adding a real one is a deliberate change — ask Tony.

## Adding a new event type or column
This is a schema change to a live backend. Flag it, list side effects, and confirm with Tony before writing. See skill `concurrency-and-hidden-bugs`.
