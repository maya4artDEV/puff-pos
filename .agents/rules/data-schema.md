# Rule: storage schema (POS — live, do not break)

## localStorage
Key format (frozen): `puff7_{safeBranch}_{dateStr}` — one state object per branch per day.

- All date strings pass through `normDateStr()` before becoming a key. Google Sheets strips leading zeros (`04/07` → `4/7`), which once caused cloud data to land under keys the app never reads. Never build a date key without normalizing.

## State object (per day)
```
{
  branch, date,
  stock: { "ORI": { received_pieces, fry_out, sold }, ... },
  stock_log: [ /* audit */ ],
  sales: [ /* events */ ],
  fry_log, withdrawals, damaged, free_items,
  pricePerPiece, lastStaff,
  gift_catalog, gift_stock, gift_sales,
  delivery_sales,
  is_closed, closedAt
}
```

## Stock reads
- Use the single `getStockForState()` accessor. `received_pieces === 0` is valid — never fall back to `packs*10` on a falsy check; test `!== undefined`.

## Carry-over (new day)
- Carry remaining stock + price + gift catalog/stock from the previous day.
- Prefer the previous day's `is_closed` state; fall back to the latest state if none is closed.

## CloudState sheet
Columns: `branch | date | updated_at | state_json`. When cleaning bad rows, delete only rows whose `state_json` is all zeros; keep rows with real received quantities.
