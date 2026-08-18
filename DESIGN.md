---
name: Puff Stick POS
description: Warm, tactile counter-POS for a Thai fried-puff-stick franchise — golden mustard and cocoa, built for fast one-handed taps.
colors:
  mustard: "#F2B33D"
  mustard-deep: "#E69A1F"
  mustard-soft: "#FCE6A8"
  cocoa: "#5C3B22"
  caramel: "#C57A3A"
  cream: "#F5E5C0"
  olive: "#94A24F"
  rose: "#E89F8A"
  blush: "#F4D9CC"
  sage: "#CFD9A8"
  sage-deep: "#B9C58F"
  lilac: "#D9CFE6"
  ice: "#A8C0D9"
  bg: "#EFEAE2"
  card: "#FFFFFF"
  card-soft: "#FBF7EF"
  ink: "#2A1F14"
  ink-soft: "#5C4A38"
  muted: "#7A6B58"
  border: "#E6DCCB"
  ok: "#4E7935"
  warn: "#E69A1F"
  bad: "#D26A5C"
  blue: "#4A7FB5"
  ok-bg: "#D1FAE5"
  ok-fg: "#065F46"
  warn-bg: "#FEF3C7"
  warn-fg: "#92400E"
  bad-bg: "#FEE2E2"
  bad-fg: "#991B1B"
  bad-bg-soft: "#FFF5F6"
  bad-border-soft: "#FECDD3"
  note-bg: "#FFFBEB"
  note-border: "#FCD34D"
  note-fg: "#92400E"
  has-bg: "#FFFBF0"
typography:
  display:
    fontFamily: "Nunito, Prompt, 'Sukhumvit Set', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Noto Sans Thai', 'Helvetica Neue', Roboto, sans-serif"
    fontSize: "46px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Nunito, Prompt, 'Sukhumvit Set', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Noto Sans Thai', 'Helvetica Neue', Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Prompt, 'Sukhumvit Set', -apple-system, BlinkMacSystemFont, 'Noto Sans Thai', 'Helvetica Neue', Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Prompt, 'Sukhumvit Set', -apple-system, BlinkMacSystemFont, 'Noto Sans Thai', 'Helvetica Neue', Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.6
  label:
    fontFamily: "Nunito, Prompt, 'Sukhumvit Set', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Noto Sans Thai', 'Helvetica Neue', Roboto, sans-serif"
    fontSize: "10px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.14em"
rounded:
  sm: "8px"
  md: "14px"
  lg: "18px"
  xl: "24px"
  pill: "100px"
  circle: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-primary:
    backgroundColor: "{colors.mustard}"
    textColor: "{colors.cocoa}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "13px 16px"
  button-primary-hover:
    backgroundColor: "{colors.mustard-deep}"
  button-secondary:
    backgroundColor: "{colors.olive}"
    textColor: "#FFFFFF"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "13px 16px"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.muted}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "11px 16px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "13px 16px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.xl}"
    padding: "14px"
  badge-ok:
    backgroundColor: "{colors.ok-bg}"
    textColor: "{colors.ok-fg}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  badge-warn:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.warn-fg}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  badge-bad:
    backgroundColor: "{colors.bad-bg}"
    textColor: "{colors.bad-fg}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
---

# Design System: Puff Stick POS

## Overview

**Creative North Star: "The Golden Hour Stall"**

Puff Stick POS looks like the counter it runs on: a fried-dough stall lit by late-afternoon gold. Mustard is the dominant voice — hero cards, primary CTAs, the active nav state, the sales headline — because a rushed staff member glancing at a phone under counter glare needs to find the one thing that matters instantly, without hunting through a palette of equally loud options. Cocoa anchors the dark, confident numerals; cream, olive, blush, sage, and lilac give each operational area (sell, fry, stock, close, history) its own soft identity without ever outshining mustard.

Every surface — card, hero, button, chip — carries the same soft ambient shadow (`--sh`). Shadow here is atmosphere, not architecture: it says "this is warm and tappable," never "this sits above that." The one exception is the glow shadow under primary CTAs and hero cards, a second, colored layer that exists purely to pull the thumb toward the next action.

The system is built for touch first: every tappable control compresses to roughly 0.96 scale on press, hover states are gated behind `@media (hover: hover)` and treated as a bonus for desktop/HQ viewers, not a requirement. Typography splits work by job — Nunito at 800–900 weight for anything numeric (prices, totals, counts, dates), Prompt for Thai body copy and labels — so a busy counter screen still reads as one warm, cohesive voice rather than a cold operations dashboard bolted onto a food brand.

**Key Characteristics:**
- Mustard-led, generously applied — the primary accent recurs on nearly every screen rather than being rationed to one element
- Ambient-only shadow (`--sh`) on every surface; a second colored glow shadow is reserved for CTAs and hero cards
- Bold Nunito numerals paired with friendly Prompt Thai text — never a flat, gray, SaaS-admin voice
- Tactile press-down feedback (~0.96 scale) on every interactive control; hover is a bonus, not a requirement
- Soft 8–24px rounding throughout, pill badges for status, no hard corners anywhere

## Colors

Warm and confident: gold-forward, cocoa-anchored, with a family of muted pastel accents (cream, olive, blush, sage, lilac, ice) that separate operational areas without ever competing with mustard for attention.

### Primary
- **Mustard** (#F2B33D): The system's one loud voice — hero card backgrounds, primary CTA fills, the active bubble-nav pill, positive highlight rings (`.fcard.has`, `.phys-cell.has`). Appears often and on purpose.
- **Mustard Deep** (#E69A1F): Hover/press state for mustard fills; also doubles as the `warn` semantic color.
- **Mustard Soft** (#FCE6A8): Soft fills behind mustard (login hero gradient, avatar backgrounds, active-state tints).

### Secondary
- **Cocoa** (#5C3B22): The dark anchor for numerals and headline text sitting on mustard/cream fields (`--f`-family display type), and the close-day hero background.
- **Caramel** (#C57A3A): Secondary warm accent — log timestamps, "change staff" links, top-filling chip highlights.

### Tertiary
- **Olive** (#94A24F): Positive/secondary action color (`.abtn.grn`), stock-summary "sold" contrast note.
- **Sage** (#CFD9A8) / **Sage Deep** (#B9C58F): History-page hero gradient, frozen-stock tri-card fill.
- **Blush** (#F4D9CC) / **Rose** (#E89F8A): Fry-page hero gradient, "sold" tri-card, export-grid sell tile.
- **Lilac** (#D9CFE6): Timer-mini card, close/export "all" tile family.
- **Ice** (#A8C0D9): Frozen-stock tri-card fill.

### Neutral
- **Bg** (#EFEAE2): App background — warm parchment, never pure white or gray.
- **Card** (#FFFFFF) / **Card Soft** (#FBF7EF): Surface fills; card-soft for slightly recessed panels (login circle backing).
- **Ink** (#2A1F14): Primary text.
- **Ink Soft** (#5C4A38): Secondary text on light surfaces.
- **Muted** (#7A6B58): Tertiary text — labels, sublabels, placeholder copy.
- **Border** (#E6DCCB): The only border color in the system; always thin (1–1.5px).

### Semantic
- **Ok** (#4E7935) on **Ok Bg** (#D1FAE5) / **Ok Fg** (#065F46): Stock-in-range, sync-complete (`☁✓`), diff-card "ตรงเป๊ะ."
- **Warn** (#E69A1F) on **Warn Bg** (#FEF3C7) / **Warn Fg** (#92400E): Low stock, syncing in progress (`☁⟳`), close-day "เกิน" (over).
- **Bad** (#D26A5C) on **Bad Bg** (#FEE2E2) / **Bad Fg** (#991B1B): Out of stock, sync failed (`☁✗`), close-day "ขาด" (short), destructive actions.
- **Blue** (#4A7FB5): The one non-warm accent, used narrowly for input focus rings on numeric/count fields (stock, cash) to visually separate "counting" inputs from "selling" ones.

### Named Rules
**The Always-Gold Rule.** Mustard is not rationed to a single element per screen — it runs through hero backgrounds, primary CTAs, active nav, and positive highlights everywhere it's earned. Its job is instant recognizability under a rushed glance, not restraint.

**The One Border Rule.** There is exactly one border color (`--border`, #E6DCCB) in the entire system. Don't introduce a second neutral border tone — differentiate surfaces with fill and shadow instead.

## Typography

**Display/Numeral Font:** Nunito (weights 700/800/900), with Prompt and system Thai fallbacks
**Body/Thai Font:** Prompt (weights 400–800), with Sukhumvit Set and system Thai fallbacks

**Character:** Bold, heavy-weight Nunito carries every number that matters — prices, totals, counts, dates — because staff scan for figures first. Prompt carries all Thai prose, labels, and UI chrome in a warmer, rounder register than a typical grotesk. The pairing deliberately avoids the flat, gray, hairline-bordered look of a generic SaaS admin dashboard; this is a food-stall tool first, an operations tool second.

### Hierarchy
- **Display** (900, 46px, line-height 1, tracking -0.04em): The day's sales total (`.sh-amount`) and other hero numerals — the single largest, boldest figure on a screen.
- **Headline** (800, 15px, tracking -0.01em): Card titles, section titles (`.card-title`, `.scc-title`).
- **Title** (700, 13px): Item names, staff names, day labels — the primary Thai-text weight for content that must scan quickly.
- **Body** (500, 12px, line-height 1.6): Secondary Thai copy — detail rows, sub-labels, tips.
- **Label** (800, 10px, tracking 0.14em, uppercase in practice): Eyebrow labels above hero numbers (`.sh-label`, `.fh-label`), section labels (`.sec-lbl`).

### Named Rules
**The Numerals-Are-Nunito Rule.** Any figure the staff needs to read at a glance — money, counts, quantities, times — renders in Nunito 800/900. Prompt never carries a hero number.

## Layout

Single-column, mobile-first, thumb-zone design for a phone or tablet held at a counter. Content sits in `.page` containers with `12px 14px` padding and generous bottom padding (120–200px) to clear the fixed bottom nav and action bar. Horizontal scroll strips (`.date-strip`, `.sc-row`) replace grids wherever content is best browsed rather than scanned in full. Grids appear only for fixed, small item counts: `.tri-grid` (3-up stock summary), `.two-col-grid` / `.fry-two-col` (2-up counting forms), `.export-grid` (2-up export tiles). Spacing rhythm runs in small, dense steps (4–20px) rather than large airy gutters — this is a data-entry tool used many times a day, not a marketing page.

The bottom bubble nav (`.nav-outer`, 82px) and, on the sell page, a stacked fixed action bar (`.action-bar`, dark `--ink` background) both float above content permanently — the two persistent anchors a cashier always has available: navigate, and complete the sale.

## Elevation & Depth

Ambient lift, never structural. Every card, hero, and floating control uses the same soft two-layer shadow token (`--sh`: `0 1px 2px rgba(60,40,20,.04), 0 8px 22px rgba(60,40,20,.07)`) — a warm, diffuse shadow tinted toward cocoa rather than neutral black. It marks a surface as "raised and tappable"; it never encodes stacking order or hierarchy between cards. A second tier exists only for calls to action: CTAs, hero gradients, and the sales/close heroes carry an additional colored glow shadow (e.g. `0 6px 20px rgba(242,179,61,.4)` under the mustard login/action buttons) that exists purely to draw the eye toward the primary action.

### Shadow Vocabulary
- **Ambient** (`0 1px 2px rgba(60,40,20,.04), 0 8px 22px rgba(60,40,20,.07)`): Default for every card, chip, and floating control.
- **Mustard Glow** (`0 4-6px 10-20px rgba(242,179,61,.35-.4)`): Primary buttons and mustard-fill surfaces.
- **Hero Glow** (per-hero, tinted to that hero's dominant color, e.g. `0 8px 28px rgba(230,154,31,.32)` for the sales hero): Large gradient hero cards only.

### Named Rules
**The No-Structure Shadow Rule.** Shadow depth never varies by importance or z-order — every surface gets the same ambient lift. Only a second, colored glow shadow is allowed, and only under something the user is meant to tap next.

## Shapes

Soft and rounded throughout — there are no hard 90° corners on any content surface. Radius scales from 8px (badges, small chips) through 14px (cards, buttons, inputs) up to 24px (heroes, modal sheets), plus true pill (100px) for status badges and toast, and true circles (50%) for avatars and icon buttons. Borders, where present, are always thin (1–1.5px) and always `--border`; heavier visual separation comes from fill-color changes (e.g. `.fcard.has`, `.phys-cell.has`) rather than thicker strokes.

## Components

### Buttons
- **Shape:** 14px radius standard (`.abtn`), 18px for the login CTA, full pill via `border-radius` only where explicitly circular (quantity +/- buttons).
- **Primary:** Mustard fill (#F2B33D), cocoa text (#5C3B22), mustard glow shadow, 13px padding. Used for the single primary action per screen.
- **Secondary (grn):** Olive fill (#94A24F), white text — confirmatory/positive actions (e.g. save stock count).
- **Danger (red):** Bad fill (#D26A5C), white text — destructive actions.
- **Outline:** White/card fill, 1.5px border, muted text — the "lesser" action beside a primary button.
- **Press feedback:** Every button scales to 0.96–0.97 on `:active`; hover (pointer devices only) dims via `filter: brightness(.9-.94)`. No button relies on hover alone.

### Chips / Badges
- **Status badges:** Pill radius (100px), 4px/10px padding, semantic bg/fg pair (ok/warn/bad). Used for stock status and category tags.
- **Filling chips:** Rounded 8px, bg-tinted, used to tag the day's top-selling fillings; the "top" variant switches to mustard-soft fill with cocoa text.

### Cards / Containers
- **Corner Style:** 16–24px depending on prominence (plain `.card` 18px, hero cards 22–24px).
- **Background:** Solid `--card` (white) for content cards; gradient fills (mustard, blush, sage, lilac, cocoa) for hero cards specific to each page.
- **Shadow Strategy:** Ambient `--sh` by default; hero cards add a tinted glow (see Elevation).
- **Border:** None on cards; borders appear only on smaller interactive rows (`.fry-row`, `.fcard`) to show a resting/selected state.
- **Internal Padding:** 12–16px typical, up to 20px for hero cards.

### Inputs / Fields
- **Style:** 1.5px `--border` stroke, `--bg` or white fill, 8–14px radius depending on size, Nunito numerals for numeric fields.
- **Focus:** Border color snaps to a context-specific accent — mustard for login/quantity fields, caramel for fry-count fields, blue for stock-count and cash fields — rather than one universal focus color. This lets staff feel which "mode" of counting they're in without reading a label.
- **Error / Disabled:** Disabled controls drop to 0.35–0.38 opacity and lose their shadow; there is no dedicated error input style beyond the semantic badge/text colors.

### Navigation
- **Style:** Fixed bottom bubble nav, 82px tall, mustard-filled SVG background shape. Six tabs with 22px line-icon + label; inactive icons sit at 0.72 scale / 0.45 opacity, the active icon floats up (-14px translateY) to 1.18 scale at full opacity with its label expanding into view. Mobile-only interaction model — no desktop-specific nav variant exists.

### Timer Modal (signature component)
Bottom-sheet modal (`.modal-sheet`, 24px top radius, slide-up transition) housing a large circular-feeling countdown card: 72px Nunito-900 tabular-numeral time, a pill progress bar (`.tc-bar`), and a two-button row where the running state recolors the main button from cocoa to a red-orange (`#C84238`) to signal "tap to stop." This is the app's highest-stakes real-time moment (frying stages) and gets the most theatrical treatment in an otherwise restrained system.

## Do's and Don'ts

### Do:
- **Do** reuse the ambient `--sh` shadow on every card/surface; never invent a new shadow value for a "new" component.
- **Do** render every price, total, count, and timestamp figure in Nunito 800/900 — numerals are always the boldest thing on the line.
- **Do** scale interactive elements to ~0.96–0.97 on `:active`; every tap needs visible, immediate feedback since this runs on touch devices at a counter.
- **Do** use pill badges (100px radius) with the fixed ok/warn/bad bg+fg pairs for any status communication — stock levels, sync state, close-day variance.
- **Do** let mustard recur across a screen (hero, CTA, active nav, highlight ring) rather than rationing it to one element.

### Don't:
- **Don't** introduce cold grays, pure-black text, or hairline-border-only cards — this is a warm, shadow-lifted, cocoa-tinted system, not a flat SaaS admin panel.
- **Don't** rely on a hover-only affordance for anything a counter-device user must be able to do; hover rules are a bonus layer gated behind `@media (hover: hover)`, never the only path to an action.
- **Don't** invent a second border color. There is one border tone (`--border`); use fill-color changes to show selected/active state instead.
- **Don't** give shadow a hierarchy job. Depth communicates "tappable," not "important" — importance is mustard's job, not the shadow's.
