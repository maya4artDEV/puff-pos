# SPEC — Issue 1: Count-First Close-Day Sales (fix "double count")

Supersedes the earlier "Reconcile 2-column view" framing. After grounding the code, the real fix is
simpler and more correct: **make the money math derive front-desk sales from the physical count, not
from tapped `S.sales`.** Production-sensitive (close-day money). Base build `20260825.0003`.

---

## Confirmed root cause (from code)

Two facts, both verified in `index.html`:

1. **Front-desk tap and delivery both do `S.stock[id].sold += pieces`** (`submitSell` L5024, `submitDelivery` L4750). Tapped/delivered pieces leave the shelf.

2. **`calcClose()` builds `expected` from tapped sales only** (L5474):
   `expected = puffAmt + giftAmt + dlvNet`, where `puffAmt = Σ S.sales.totalAmount` = **front-desk TAPPED sales only.**
   Meanwhile the physical count in `onPhysCount()` (L5413) computes the true sold
   (`fry_out − counted − damaged − free`) but **only displays it** — it never feeds `calcClose`, and the
   counts aren't stored anywhere.

**Result:** `net` (real cash) reflects *all* front-desk sales, but `expected` counts only the *tapped*
ones. Since staff rarely tap during the day (customers won't wait — 18 yrs of it), `puffAmt ≈ 0` while
real cash is full → every such day shows a large false **"เกิน"**, and any partial tapping makes the two
on-screen numbers disagree. That mismatch is what reads as "double / ยอดไม่ตรงทุกวัน."

Worst case (matches the report): fry 100, none tapped, 70 left on shelf, sell 30 cash.
`onPhysCount` → 30 sold (correct). `calcClose` → `puffAmt = 0` → expected ฿0 → shows "เกิน ฿750". Wrong.

---

## Fix — count-first `expected`

Make the physical count the source of truth for front-desk revenue. Delivery money stays separate
(it's Net, paid via app, not in the drawer), gift stays separate.

### Per-filling
```
totalSold      = fry_out − counted − damaged − free      // physical truth (incl. delivery pieces)
deliverySold   = Σ delivery_sales pieces for this filling // from delivery records' items[]
frontDeskSold  = max(0, totalSold − deliverySold)
frontDeskRev  += frontDeskSold × getPrice(filling)
```
### Aggregate (replaces `puffAmt`)
```
expected = frontDeskRev + giftAmt + dlvNet
net      = cash − float − withdrawals + transfer + dlvNet   // unchanged
diff     = net − expected                                    // unchanged
```
Delivery pieces are subtracted from front-desk revenue so they aren't counted at retail here **and**
again as `dlvNet` (that would be the real double). `S.sales` (tapping) becomes an **audit/assist**
trail only — it still logs to the sheet and Telegram, it just no longer drives the money math. So a
branch that never taps and a branch that taps everything both reconcile correctly.

---

## Required supporting change — persist the physical count

The count is now the source of truth, so it must be stored like `damaged`/`free_items` (which already
live in `S.`), not left in DOM:

- Add **`S.counted = {}`** to the state object (init at L3953 area, next to `damaged`/`free_items`).
- `onPhysCount` writes `S.counted[id] = value; save();` on input (mirror the `damaged`/`free_items`
  `oninput` handlers at L5433) and `renderClose` restores `pc-<id>` from `S.counted`.
- Include `counted` in cloud sync (state payload) and in the **new-day carry-over reset** — counted
  must reset to empty each day (a leftover count is per-day), same lifecycle as `damaged`/`free_items`.
- `calcClose` reads `S.counted` (not DOM) so it recomputes correctly after refresh / device switch.

---

## Decisions to confirm (SPEC-level)

- **1-D4 — expected before counts are entered.** Until leftovers are counted, front-desk revenue is
  unknown. Options: (a) show `expected` as "ยังไม่ได้นับเหลือ" / pending until at least the counted
  fields are filled; (b) fall back to tapped `S.sales` in the meantime; (c) block "ยืนยันปิดวัน" until
  counted. → **rec: (a) pending state + (c) block confirm until counted**, since count is now the
  official number. Cash diff simply doesn't show until counts exist.
- **1-D5 — keep tapped total visible?** → **rec: yes**, as a small reference line ("กดขายระหว่างวัน
  (อ้างอิง): ฿X") separate from the money math, so branches using the drawer still see their tapped
  figure without it affecting `expected`.
- **1-D6 — confirm `counted` resets daily** (not carried over). → **rec: yes** (per-day, like damaged/free).

Earlier decisions still hold and are now simpler: 1-D1 (auto), 1-D2 (pieces), 1-D3 (report the count-
derived final) — with a single formula there's no A/B pick to make; "final" is always count-derived.

---

## Impact / risk
- Touches `calcClose()` + `onPhysCount()` + `renderClose()` + state init + carry-over + cloud sync.
  All in the close tab plus the state shape. **Money math + new persisted field + sync** → highest-care.
- New `S.counted` is additive; existing keys untouched. Old saved states without `counted` default to
  `{}` (guard on read, like the DUR guard pattern).
- Sheet export may add a "counted" column; the existing `ขายจริง(ชิ้น)` becomes count-derived.
- No change to `submitSell`/`submitDelivery` stock writes — tapping/delivery still decrement `sold` as
  today; only the close-day *money read* changes.

## Gate to PLAN
- Confirm 1-D4, 1-D5, 1-D6.
- PLAN-time grounding: exact carry-over site (L3946/3996 area) + cloud state payload shape, to wire
  `counted` into save/restore/reset without touching unrelated fields.
- Attach the deployed `index.html` baseline for surgical targeting.

## Out of scope (separate)
- Issue 2 (per-branch custom fry fillings) — decisions already captured; its own SPEC next.
- Any change to how cash/transfer are entered, or to the delivery commission model.
