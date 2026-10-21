# PLAN — Feature B: Franchise `gift_sale` Handler (backend/franchise/Code.gs)

Executor: **Antigravity** — single surgical `str_replace`.
**Scope: franchise `.gs` ONLY. Do NOT touch owner `.gs` or `index.html`.**
Pre-validated by NOVA: handler is **byte-identical** to owner's, `node --check` PASS, ordering correct.
D-B1 confirmed (exact mirror). D-B2: code now, **deploy in the next franchise `.gs` window** (not immediately).

## Baseline & target
| File | Pre-edit MD5 | Post-edit MD5 (target) | EOL |
|------|-------------|------------------------|-----|
| `backend/franchise/Code.gs` | `9d486696529d73e140eaaa0b7fc1fa04` | `73ca3c633188a6ce447df1b467697eec` | **CRLF** |

> Owner `.gs` (`052187c2…`) and `index.html` (`72701e37…`) must stay untouched.

## Why this is needed (confirmed)
Franchise `.gs` has the `// ── ขายของฝาก ──` comment but **no handler after it** — the handler was never mirrored. Franchise gift sales POST `{type:"gift_sale"}` and currently fall through unhandled. Owner has the handler at L141; the client (`submitGiftSale`) already sends `grandTotal` + `items` + `staff` + `ts`, so the owner handler works verbatim on franchise.

Note: `gift_sales` (with **s**) at franchise L17 is a state field in `isEmptyState`, unrelated — do not confuse with the `gift_sale` handler.

---

## B1 — Insert `gift_sale` handler (exact owner mirror)

The franchise router has the gift comment immediately followed by a blank line and the Delivery comment. Insert the handler **between** the gift comment and that blank line, so ordering matches owner (`gift_sale` before `delivery_sale`).

**old_str:**
```
    // ── ขายของฝาก ──

    // ── Delivery Sales ──
```
**new_str:**
```
    // ── ขายของฝาก ──
    if (data.type === "gift_sale") {
      var sheet = ss.getSheetByName("GiftSales") || ss.insertSheet("GiftSales");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["\u0e40\u0e27\u0e25\u0e32","\u0e2a\u0e32\u0e02\u0e32","\u0e0a\u0e37\u0e48\u0e2d\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32","\u0e08\u0e33\u0e19\u0e27\u0e19","\u0e23\u0e32\u0e04\u0e32/\u0e0a\u0e34\u0e49\u0e19","\u0e22\u0e2d\u0e14\u0e40\u0e07\u0e34\u0e19","\u0e1c\u0e39\u0e49\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01"]);
        sheet.getRange(1,1,1,7).setFontWeight("bold").setBackground("#0F4C36").setFontColor("#fff");
        sheet.setFrozenRows(1);
      }
      data.items.forEach(function(it){ sheet.appendRow([data.ts, data.branch, it.name, it.qty, it.price, it.total, data.staff.name]); });
      var giftList = data.items.map(function(i){ return "  \u2022 " + i.name + " \u00d7 " + i.qty + " \u0e0a\u0e34\u0e49\u0e19"; }).join("\n");
      var giftTotal = data.items.reduce(function(s,i){ return s+(i.qty||0); }, 0);
      notifyTelegram(
        "\ud83c\udf81 \u0e02\u0e32\u0e22\u0e02\u0e2d\u0e07\u0e1d\u0e32\u0e01\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n" +
        "\ud83d\udccd \u0e2a\u0e32\u0e02\u0e32: " + data.branch + "\n" +
        "\ud83d\udc64 \u0e1e\u0e19\u0e31\u0e01\u0e07\u0e32\u0e19: " + data.staff.name + "\n" +
        "\ud83d\udce6 \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23:\n" + giftList + "\n" +
        "\ud83d\udcca \u0e23\u0e27\u0e21: " + giftTotal + " \u0e0a\u0e34\u0e49\u0e19\n" +
        "\ud83d\udcb0 \u0e22\u0e2d\u0e14: \u0e3f" + Number(data.grandTotal).toLocaleString("th-TH") + "\n" +
        "\ud83d\udd50 \u0e40\u0e27\u0e25\u0e32: " + data.ts
      );
    }

    // ── Delivery Sales ──
```

> CRLF on every line. Do not touch `TG_BOT_TOKEN` (`""`). No other edits — franchise `.gs` has no build stamp.

---

## Audit (NOVA, after apply)
- MD5 == `73ca3c633188a6ce447df1b467697eec`
- copy `.gs`→`.js`, `node --check` PASS · EOL CRLF preserved
- `grep -c 'data.type === "gift_sale"'` == 1
- gift_sale handler block **byte-identical** to owner L141–160 (verified: identical in pre-validate)
- ordering: `gift_sale` before `delivery_sale`
- `TG_BOT_TOKEN  = "";` unchanged · owner `.gs` + `index.html` untouched

---

## Deploy (D-B2 — next window, not now)
1. Commit franchise `.gs` to repo.
2. When ready for the next franchise Apps Script deploy: **Deploy → New version** (franchise only; owner unaffected).
3. No client push needed — client already sends the correct payload.

## Test (deploy-day)
- T-B1: franchise records a gift sale → new row in franchise `GiftSales` sheet, columns match owner.
- T-B2: franchise Telegram fires the 🎁 ขายของฝาก message.
- T-B3: existing franchise `sale` / `fry` / `delivery_sale` / `branch_auth` unaffected.
