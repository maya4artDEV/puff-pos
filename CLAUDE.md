# CLAUDE.md — PuffStick POS

Claude Code specifics:
- A **SessionEnd hook auto-captures** this session to Context Hub at the end.
  → In Claude Code, only **retrieve** from Context Hub at the start of work.
  Do NOT manually capture — the hook handles it.
- **Production POS.** `index.html` at repo root IS production (static, GitHub Pages);
  Apps Script + Sheets is the backend (Owner + Franchise `.gs`, copy-pasted by Tony —
  not deployed from this repo). **No Firebase in POS.** Only `var` / `function(){}`,
  build DOM through `el()`, never touch the `puff7_` localStorage key or live event
  types. Show `node --check` output before claiming done.

Full agent identity, hard deny rules, cross-system schema, skills, and the Context
Hub protocol:

@AGENTS.md
