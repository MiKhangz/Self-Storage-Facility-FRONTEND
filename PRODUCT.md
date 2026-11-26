# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: real self-storage renters in Ho Chi Minh City. People moving home, renovating, or running a small business or online shop, who need a locked unit for weeks to months. They search by facility and size, compare monthly prices, reserve online, then come to the facility once to check in. After that they return only to pay, renew, report a problem or move out.

Secondary: facility workers using the admin portal on a desk computer at the facility:

- **Facility Staff:** check-in, handover, returns and support.
- **Facility Manager:** units, contracts, shifts and tickets at their facilities.
- **Business Operations Manager:** pricing, deposits and reports across all facilities.
- **System Administrator:** staff accounts and the activity log.

The work is judged as if real customers will use it; every customer flow must hold up for a real renter.

## Product Purpose

StorEase lets a customer rent a storage unit end to end online. They find a facility, pick a size and period, see the real price, and reserve. They sign the contract, get a personal gate access code at check-in, pay monthly, renew, and move out with the deposit refunded. Staff run the facility side of the same lifecycle in one portal.

Success means a renter can go from "I need space" to a confirmed reservation without calling anyone. Staff can see and act on every reservation, contract, invoice and ticket without leaving the portal.

## Positioning

Self-service with a hard rule set, not a listing site: prices, availability, discounts, deposit, notice period and overdue escalation all come from one active pricing policy and are enforced by the backend. What a customer sees quoted is what the contract records. A later price change never alters a signed contract.

## Operating Context

The rental lifecycle has seven flows, in this order:

1. Account and access.
2. Facility and unit management.
3. Booking and reservation.
4. Check-in and handover.
5. Contract, access code and renewal.
6. Billing, payment and overdue handling.
7. Move-out, return inspection and support.

Customers mostly use phones. Staff use desktop browsers at the facility front desk. Money is Vietnamese đồng, formatted with `Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })`. Dates show in the `Asia/Ho_Chi_Minh` time zone.

## Capabilities and Constraints

- **Stack:** React 18 + Vite in JavaScript, with TanStack Query. The API client is generated from the backend's OpenAPI spec into `src/api/generated/` (JSDoc-documented). The backend is .NET 8 in the `Self-Storage-Facility-BACKEND` repo.
- **Auth:** a JWT bearer token kept in memory only, never in `localStorage` (assignment requirement), so a reload signs the user out.
- **Business rules the UI must not contradict:**
  - A unit carries one active contract at a time.
  - Reserving does not occupy a unit.
  - Handover, not signing, activates the contract and issues the access code.
  - Overdue cases escalate: reminder, then late fee, then lockout.
  - The deposit is refunded only after the return inspection.
  - Move-out needs notice.
  - Facilities, units and users with history are deactivated, never deleted.
- **Two parallel frontends:** the FE team builds the official one. This repo's `Khang/FE` branch is a backup in plain `.jsx` + per-component CSS, matching the FE team's style.
- **Undecided or missing:** online payment (no real gateway yet), and staff-created walk-in reservations, which the API does not allow.

## Brand Commitments

- The name is **StorEase**, an invented brand. Never use MyStorage (the reference site) branding, logos or copy.
- **UI copy is Vietnamese.** Code and comments stay English. Current screens are still in English, copied from the Figma file, and need translating.
- Every page footer states that this is an SWP391 student project at FPT University and not a real service.
- Design source: the team's Figma file `G06bAqZHAoKI7gGVZvsRca`. Page `0:1` holds the customer screens U01–U16, page `1:2` the admin screens A01–A21.

## Evidence on Hand

- The Figma file above, with all 37 screens.
- Backend demo data: one facility (StorEase Gò Vấp), six units, two unit types, demo accounts for each role.
- Docs in the backend repo: `docs/api-endpoints.md` and `docs/DEMO_PLAN.md`.

There are no real customers, reviews, ratings, testimonials, press or usage statistics. Figures in the Figma marketing copy are design placeholders and must not be shown as real claims: "4.9/5 from 600+ reviews", "8 locations", "1,000 units" and similar.

## Product Principles

1. **Show the real price.** Every figure a customer sees comes from the active pricing policy or their own invoices, never from copy.
2. **The backend is the rulebook.** Screens explain a rule the API enforces; they never promise something the API refuses.
3. **Honest gaps.** A feature the backend cannot do yet is stated plainly on the screen, not faked or hidden.
4. **One lifecycle, two sides.** Customer and staff screens describe the same reservation, contract and invoice with the same names and statuses.

## Accessibility & Inclusion

WCAG 2.1 AA:

- Text contrast meets AA.
- Every action works by keyboard.
- Every input has a label.
- Focus is visible.
- Status is never shown by colour alone.

Copy is Vietnamese-first and must handle Vietnamese diacritics in names, addresses and search.
