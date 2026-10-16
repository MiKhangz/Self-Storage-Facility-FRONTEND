---
target: Home page
total_score: 15
max_score: 32
na_heuristics: 7,10
p0_count: 1
p1_count: 3
target_identity: "file:D:\\Self-Storage-Facility-FRONTEND\\src\\customer\\home\\HomePage.jsx"
target_fingerprint: "sha256:bce1512e3ed634fc0675113f45beded7df495e4afb434ebfd284527fb9fa6309"
target_path: "D:\\Self-Storage-Facility-FRONTEND\\src\\customer\\home\\HomePage.jsx"
timestamp: 2026-10-16T15-31-50Z
slug: src-customer-home-homepage-jsx
---
Method: dual-agent (A: design review sub-agent · B: detector sub-agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No loading/error states on search dropdowns or Locations; failed quote shows bare "— / month" |
| 2 | Match System / Real World | 1 | English copy for Vietnamese renters; "1 · 1 units available"; "10 m² · 10 m²" option |
| 3 | User Control and Freedom | 3 | Search hands off to /booking non-destructively |
| 4 | Consistency and Standards | 1 | 4+ orange-filled buttons (One Door Rule); cyan used as a button; en vs vi-VN number formats |
| 5 | Error Prevention | 2 | Promises sizes (1–30 m²) and services that do not exist |
| 6 | Recognition Rather Than Recall | 3 | Labels visible; no mobile menu |
| 7 | Flexibility and Efficiency | n/a | Persuade surface |
| 8 | Aesthetic and Minimalist Design | 2 | 8 bands; services and compare sections are filler; 2 size cards in a 4-col grid |
| 9 | Error Recovery | 1 | No error text or retry when facilities/unit-types/quote calls fail |
| 10 | Help and Documentation | n/a | Landing page |
| **Total** | | **15/32** | **Poor (47%)** |

## Design Specificity Verdict

LLM: the hero illustration (roll-up doors, unit codes, "B-103 unlocked" toast) and real-data search are product-specific; the rest (tagline, fake stats strip, 6 icon-tile services, "Most popular" two-plan compare, 4 step cards, fake grid map, dark CTA band) is category-interchangeable, and half of it describes services the product does not offer. Not anchored in HCMC or Vietnamese.

Deterministic scan: CLI `detect` on HomePage.jsx + CustomerLayout.jsx returned 0 findings (static JSX). Browser overlay found 16 (desktop) / 17 (mobile): low-contrast ×2 (white on cyan hero unit 2.4:1; orange eyebrow on Paper 4.4:1), icon-tile-stack ×6, kicker-above-heading ×5, nested-cards ×3 (false positive: field wrappers), repeating-stripes ×1 and grid-background ×1 (deliberate illustration), text-occlusion ×1 on mobile (hero badge covers sign, HomePage.css:37).

## Priority Issues

- [P0] Fake claims and non-existent services shown as real: hero stats "8 Locations" / "4.9/5 From 600+ reviews"; "1 m² to 30 m²"; hardcoded "from 890,000 ₫" / "99,000 ₫"; shelf storage, luggage, wine, insurance; "pay online by card, e-wallet"; "Most popular". Fix: real API figures; cut or rebuild compare/services; honest step 2. → clarify, distill
- [P1] All UI copy English; primary audience reads Vietnamese. → clarify
- [P1] One Door Rule and palette violations: several orange-filled CTAs, cyan CTA button, shadow on featured plan card. → quieter, polish
- [P1] API states and data edge cases: missing quote still bookable, no error/retry, no Locations empty state, plural bug, duplicate option, decorative map pins. → harden
- [P2] Mobile path long; nav hidden with no menu under 1100px; search below illustration on phones. → adapt, layout

## Persona Red Flags

Jordan: four competing "book/find" buttons; "Shelf storage" leads to a support ticket; no deposit/notice info before booking.
Riley: 8 vs 3 locations; 890,000 ₫ vs 1.600.000 ₫; S5 bookable with no price; footer links are not links; VI | EN toggle inert.
Casey: no mobile menu; search below the art; phone number hidden under 1100px.
Vietnamese mover in HCMC: English marketing; districts buried; payment claims that don't exist.

## Minor Observations

`.se-card p` 13px below body token; `.se-hint.error` #e5484d ~3.9:1 fails AA; first location "active" by default; hash links lack scroll-margin-top under the sticky header; "free quote" opens a support form.

## Questions to Consider

- Could the headline be the search?
- Would a page about the real facilities (real price, address, hours) persuade better than a pretend city-wide chain?
- What does a renter mid-move need in the first 5 seconds?
