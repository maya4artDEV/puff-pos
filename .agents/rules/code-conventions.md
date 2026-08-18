# Rule: POS code conventions (`index.html`)

Applies to `index.html` (the POS app). Full reference: `docs/puffstick-conventions.md`.

## JavaScript — DO
- `var` only. Never `let` / `const`.
- `function(){}` only. Never arrow functions.
- Build **all** DOM through the `el(tag, attrs, kids)` helper. Never touch the helper itself.
- IIFE for closures in loops: `(function(id){ ... })(id)`.
- Concatenate strings with `+`. Never rely on adjacent string literals (`'a' 'b'`).
- localStorage prefix `puff7_`.
- Filling IDs = 3-char UPPERCASE: `ORI`, `SEA`, `BNN`.
- Branch codes = `XXX-NN` (e.g. `SBR-01`). Event branches start with `E`.

## JavaScript — DON'T (these caused real bugs)
- No `innerHTML` concatenation with nested quotes → use `el()`.
- No template literals (`` ` ``) in DOM rendering.
- No Python-style escaping (`\'`).
- No `var location` (shadows `window.location`) → use `locName`.
- No `oninput` that triggers a full re-render (cursor jumps) → update only the sum element.

## Known bug patterns — prevent, don't re-introduce
| Symptom | Cause | Prevention |
|---|---|---|
| `SyntaxError` in JS | Python-style escaping | raw strings, no `\'` |
| functions undefined | adjacent string literals | always `+` |
| style parser broken | single quote inside `style="font-family:'X'"` | use a CSS class |
| cursor jumps in input | `oninput` re-renders list | update sum node only |
| `location` shadowing | `var location` | use `locName` |

## Before presenting any JS change
1. Extract the `<script>` block, run `node --check` — must be 0 errors.
2. Brace balance verified.
3. No bare `return` outside a function.
4. `str_replace` one spot at a time — never regenerate the file.
5. Diff over ~100 lines → stop, the approach is wrong.
6. Bump the build stamp inside `index.html` when you ship a change.
