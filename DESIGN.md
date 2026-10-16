---
name: StorEase
description: Self-storage rental in Ho Chi Minh City — book online, check in once, manage everything from one account.
colors:
  primary: "#cc4b09"
  primary-dark: "#9a3412"
  primary-light: "#fdba74"
  primary-soft: "#fff1e6"
  primary-tint: "#fed7aa"
  charcoal: "#1f2937"
  charcoal-deep: "#111827"
  charcoal-raised: "#374151"
  on-dark-muted: "#c7ccd4"
  ink: "#1c1917"
  stone-muted: "#57534e"
  stone-faint: "#a8a29e"
  line: "#e7e5e4"
  paper: "#fafaf9"
  white: "#ffffff"
  signal-cyan: "#06b6d4"
  ok-bg: "#e3f6ec"
  ok-text: "#1a7f55"
  warn-bg: "#fef3c7"
  warn-text: "#b45309"
  danger-bg: "#fdecec"
  danger-text: "#d92d20"
typography:
  display:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 700
    lineHeight: 1.12
  headline:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
  body:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.5px"
  eyebrow:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "1px"
rounded:
  xs: "4px"
  sm: "8px"
  md: "10px"
  lg: "14px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  section: "80px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "0 22px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.white}"
  button-outline:
    backgroundColor: "{colors.white}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "0 22px"
    height: "44px"
  button-ghost:
    backgroundColor: "{colors.white}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.sm}"
    padding: "0 22px"
    height: "44px"
  button-small:
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "32px"
  card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.lg}"
  input-field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  badge-ok:
    backgroundColor: "{colors.ok-bg}"
    textColor: "{colors.ok-text}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  badge-warn:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.warn-text}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  badge-danger:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger-text}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  nav-admin-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "9px 10px"
---

# Design System: StorEase

## Overview

**Creative North Star: "The Bright Roll-Up Door"**

StorEase is the orange door you can spot from the street: warm, easy to open, and plainly marked. Everything around the door is calm stone and charcoal, so the one bright thing tells you where to go. The customer site is the friendly front of a facility a first-time renter is about to trust with their belongings. It uses soft corners, tinted bands and generous padding, and every price and status is stated plainly. The admin portal is the same building seen from the front desk. It has a charcoal sidebar with denser tables and the same components. It shares the tokens rather than inventing a second look.

The system is light-first and flat at rest. Cards are separated by a hairline border, not a shadow. Depth appears only where something floats: the hero illustration's badges, the booking search bar, a sticky summary. Type is one family, Be Vietnam Pro, chosen because it renders Vietnamese diacritics cleanly at every weight. Hierarchy comes from weight (400 to 800) and size, never from a second typeface.

**Key Characteristics:**
- One loud colour (storage orange), used as a signal, on a quiet charcoal-and-stone base.
- Soft, friendly forms: 14px cards, 8px controls, pill badges.
- Flat surfaces with hairline borders; shadows only for floating elements.
- One type family, Be Vietnam Pro, carrying every role.
- Customer site and admin portal share every token and component; the admin side is simply denser.

## Colors

A warm, two-colour system: storage orange as the signal, charcoal as the structure, and warm stone greys as the surfaces in between.

### Primary
- **Storage Orange** (`primary`): the roll-up door. Only on the main action on a screen, the active item in the admin sidebar, eyebrow labels, links and the highlighted column of a price table. White text on it passes WCAG AA (4.6:1); keep that ratio if the value ever changes.
- **Rust** (`primary-dark`): the pressed and hover state of Storage Orange, and the text colour on Orange Mist backgrounds (alerts, pills).
- **Apricot** (`primary-light`): orange as it reads on charcoal, such as the "Ease" in the logo and icons in the dark login panel. Never on white; it fails contrast there.
- **Orange Mist** (`primary-soft`): the faint orange wash behind the hero, page heads, icon tiles, selected table rows and info alerts.
- **Peach** (`primary-tint`): a slightly stronger orange tint for tinted fills that must read as orange, not as white.

### Secondary
- **Signal Cyan** (`signal-cyan`): counters only, such as the badges on admin sidebar items and the cyan button. Always paired with charcoal text, never white.

### Neutral
- **Charcoal** (`charcoal`): headings, the admin sidebar, the login brand panel and the dark CTA band. The structural colour.
- **Night** (`charcoal-deep`): the footer, one step darker than Charcoal so the page ends on firm ground.
- **Raised Charcoal** (`charcoal-raised`): hover and card surfaces inside dark areas.
- **Fog** (`on-dark-muted`): secondary text on Charcoal and Night.
- **Ink** (`ink`): body text on light surfaces.
- **Stone** (`stone-muted`): secondary text, captions and table headers.
- **Pebble** (`stone-faint`): placeholders and "off" markers only; too light for real text.
- **Hairline** (`line`): every border and divider.
- **Paper** (`paper`): soft section bands, table headers and the admin canvas.

### Status
- **Green / Amber / Red** (`ok-*`, `warn-*`, `danger-*`): availability and status badges. Green means available, paid or active. Amber means low, pending or due. Red means booked out, overdue or an error. Each badge also carries a text label, so status never depends on colour alone.

### Named Rules
**The One Door Rule.** Storage Orange marks the single thing to do next. A screen has one orange-filled button. Everything else uses outline, ghost or link buttons.

**The Apricot-Stays-Dark Rule.** Apricot is for charcoal backgrounds only. On white, use Storage Orange or Rust.

## Typography

**Display Font:** Be Vietnam Pro (with system-ui, sans-serif)
**Body Font:** Be Vietnam Pro (same family)

**Character:** a single humanist sans that is friendly at 800 weight in headlines and quiet at 400 in tables. It was picked for clean Vietnamese diacritics, which matters because UI copy is Vietnamese.

### Hierarchy
- **Display** (700, 56px, line-height 1.12): the home hero headline only; 38px under 640px.
- **Headline** (700–800, 40px, line-height 1.2): section headings and page-head titles; 30px under 640px. Admin page titles use 28px at 800.
- **Title** (700, 17–22px): card titles, panel headings, unit codes and prices in summaries.
- **Body** (400, 14–15px, line-height 1.6): paragraphs, table cells and form text. Lead paragraphs go up to 17–18px.
- **Label** (600, 11–13px): table headers (11px, uppercase, 0.5px tracking), field labels (13px) and badges (12px).
- **Eyebrow** (700, 13px, 1px tracking, Storage Orange): the uppercase kicker above a section heading.

### Named Rules
**The One Family Rule.** Every role is Be Vietnam Pro. Hierarchy comes from weight and size, never from a second typeface.

## Layout

The content column is a centred container of at most 1280px with 16px side gutters. Customer pages stack full-width bands: hero, then sections with 80px vertical padding (56px on phones), alternating white and Paper. Grids carry the content: 6 service cards, 4 size cards and 4 step cards, which collapse to 3, then 2, then 1 column.

Account and booking pages use a main column with a 300–400px side panel (sidebar nav, booking summary, request details). The side panel stacks under the main column below 1100px.

The admin portal uses a fixed 240px charcoal sidebar with a fluid main area and 28px padding. Pages there are a header row, a row of stat cards (`repeat(auto-fit, minmax(200px, 1fr))`), and a table or board. A list and a 340px side panel sit side by side when a row is selected.

Breakpoints in use: 1100px (main layout collapses), 900px (admin sidebar becomes a top strip), 640px (phone). The spacing rhythm is multiples of 4px: 8, 12, 16, 20, 24 and 40px.

## Elevation & Depth

The system is flat by default. Surfaces are white on Paper and are separated by a 1px Hairline border, not by shadow.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 10px 30px rgba(17, 24, 39, 0.08)`): things that sit above the page, such as the home search bar and the booking ticket.
- **Callout** (`box-shadow: 0 8px 24px rgba(17, 24, 39, 0.15)`): small floating labels, such as the badges over the hero illustration and the map tooltip.
- **Pin** (`box-shadow: 0 4px 12px rgba(17, 24, 39, 0.2)`): map pins.
- **Selected tab** (`box-shadow: 0 1px 3px rgba(17, 24, 39, 0.1)`): the active segment in a segmented tab control.

### Named Rules
**The Flat-By-Default Rule.** A card at rest has a border and no shadow. Shadow means "this floats above the page", not "this is important".

## Shapes

The form language is soft and friendly, never sharp:
- **Cards** have gently rounded corners (14px).
- **Controls** are a step tighter (8px): buttons, inputs, selects and chips.
- **Icon tiles and option rows** sit between the two (10px).
- **Badges, pills and counters** are full capsules (999px).
- **Avatars and status dots** are circles.
- **Borders** are always 1px Hairline. A selected card, unit option or plan switches to a 2px Storage Orange border.

## Components

### Buttons
- **Shape:** gently rounded (8px), 44px tall by default. Small buttons are 32px, used in table rows; large ones are 52px, used in the hero and on booking calls to action.
- **Primary:** a Storage Orange fill with white 15px semibold text. It turns Rust on hover.
- **Outline:** white with a Storage Orange border and text, gaining an Orange Mist fill on hover. Used for secondary actions next to a primary.
- **Ghost:** white with a Hairline border and Charcoal text, for neutral actions such as Cancel, Log in and filters.
- **Danger:** white with a red border and text, for destructive actions such as terminating a contract or requesting move-out.

### Chips
- **Style:** 40px tall, 8px corners, Hairline border, white fill. Used for size, period and urgency choices.
- **State:** a selected chip gets a 2px Storage Orange border, an Orange Mist fill, Rust text and a leading check icon.

### Cards / Containers
- **Corner Style:** 14px.
- **Background:** white on a Paper or white page.
- **Shadow Strategy:** none at rest (see Elevation).
- **Border:** 1px Hairline; 2px Storage Orange when selected or featured.
- **Internal Padding:** 18–24px; panels use 24px.

### Inputs / Fields
- **Style:** 44px tall, 8px corners, Hairline border, white fill, with an optional leading 16–18px outline icon in Stone.
- **Focus:** the border turns Storage Orange.
- **Error:** a red border with a 12px red hint line underneath. Disabled and read-only fields take a Paper fill.

### Navigation
- **Customer header:** white, sticky and 78px tall, with a Hairline bottom border. Nav links are 15px medium Charcoal and turn Storage Orange on hover or when active. Under 1100px the links hide and only the account and booking buttons remain.
- **Admin sidebar:** Charcoal, 240px wide, with uppercase 11px group titles. Items are 14px with an outline icon. The active item takes a Storage Orange fill with white text, and queue counters are Signal Cyan pills.

### Status Badge (signature)
A pill with a 5px leading dot in the text colour, 12px semibold. Green, Amber, Red, Blue (occupied) and Muted variants carry every status in the product: availability, reservation, contract, invoice and ticket. The label always names the status; the colour only reinforces it.

## Do's and Don'ts

### Do:
- **Do** keep one Storage Orange filled button per screen, and use Outline or Ghost for the rest.
- **Do** separate cards with a 1px Hairline border, and save shadows for floating elements.
- **Do** pair every status colour with a text label (WCAG 2.1 AA: never colour alone).
- **Do** use Rust, not Storage Orange, for text on Orange Mist backgrounds.
- **Do** format money with `vi-VN` VND and dates as `dd/mm/yyyy` in the Ho Chi Minh City time zone.

### Don't:
- **Don't** put Apricot or white text on light backgrounds; Apricot exists only for charcoal surfaces.
- **Don't** put white text on Signal Cyan; it is always paired with Charcoal text.
- **Don't** introduce a second typeface or a second brand colour.
- **Don't** use MyStorage branding, logos or copy anywhere.
- **Don't** drop the footer line stating this is an SWP391 student project and not a real service.
