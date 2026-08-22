# DUR-001 · Durian Permanent Filling (per-filling price)

**Status:** In Progress
**Build grounded against:** 20260822.2052 (6319 lines, MD5 EEA718AB669F8DDA931FBDBA1B8CEFF8)

## Confirmed anchor lines (verified against disk before any edit)

| Task | Line | Anchor |
|------|------|--------|
| T1 F master | 3820–3832 | `var F = [` … `];` |
| T1 BAR_COLORS | 3834 | 11-color array |
| T1 /11 (renderSell) | 4825 | `selCnt + "/11 ไส้"` |
| T1 /11 (updBar) | 4854 | `s + "/11 ไส้"` |
| T2 newState | 3888–3898 | returns object with pricePerPiece:25 |
| T2 normalize-on-load | 4003–4010 | F.forEach stock guard block |
| T2 newStateWithCarryOver | 3931–3949 | carries pricePerPiece + gift |
| T3 getPrice | 4789 | `function getPrice() { return S ?...` |
| T4 sell render price | 4767 | `var price = S.pricePerPiece \|\| 35` (priceBanner) |
| T4 updBar | 4847–4854 | `var price = getPrice(); var total...` |
| T4 submitSell | 4863–4884 | `var price = getPrice(); var staff...` |
| T5 onPhysCount baht | 5259+5265 | `var price = S.pricePerPiece \|\| 25` |
| T5 calcClose price | 5318 | `var price = S.pricePerPiece \|\| 25` |
| T5 export close rows | 5615–5619 | `var price` from buildExcelData; `sold * price` |
| T5 export sales rows | 5598 | `s.pricePerPiece` per item |
| T8 build stamp | 12,13,3451 | 20260822.2052 |

## Task status
- [x] Pre-implementation (hash verified, plan saved)
- [ ] T1 — Add DUR to F + BAR_COLORS + fix /11
- [ ] T2 — fillingPrices seed + migration + carry-over
- [ ] T3 — getPrice(id) resolver
- [ ] T4 — Sell flow per-item price
- [ ] T5 — Close-day + export per-filling baht
- [ ] T6 — owner.gs sale handler
- [ ] T7 — franchise.gs sale handler
- [ ] T8 — Build stamp bump
