# End-to-end tests (Playwright)

They drive the real app in a browser, frontend and backend together, the way a customer and the staff use it.

## Run

```bash
npm run e2e
```

That one command:

1. builds the backend into `e2e/.backend` (it expects the backend repo next to this one, at `../Self-Storage-Facility-BACKEND/BE`);
2. rebuilds the **`StorEase_E2E`** database from scratch and loads the demo data (`--seed-only --reset`; your normal `StorEase` database is never touched);
3. starts the API on `http://localhost:5208` and the frontend on `http://localhost:5273`, so it runs next to your usual dev servers;
4. runs every `e2e/*.spec.js` in Chromium, one at a time.

Needs SQL Server Express (`localhost\SQLEXPRESS`), the .NET 8 SDK, and once: `npx playwright install chromium`.

After a failure, `npm run e2e:report` opens the report with the screenshot, video and step-by-step trace.
To watch it run: `npx playwright test --headed`, or step through with `npx playwright test --ui`.

Settings you can override: `E2E_BACKEND_DIR`, `E2E_DB_CONNECTION`, `E2E_API_PORT`, `E2E_WEB_PORT`.

## What is covered

| Test | Flow |
|---|---|
| E01 | Register and sign in |
| E02–E05 | Book a unit, pay the deposit, staff assign a unit, draft the contract, customer signs, check-in |
| E06–E08 | Rent billed and paid online, renewal approved by the manager, handover inspected and the deposit settled |
| E09–E10 | Walk-in booking at the desk; unpaid rent → overdue case → lock-out → cash payment restores access |
| E11–E12 | Admin opens a facility with a floor and a unit; admin creates staff, a manager changes only their own facility |

## Writing a test

- Sign in with `loginCustomer` / `loginStaff` from `helpers.js`. The token lives in memory, so after signing in move with
  clicks (`openAdmin(page, 'Payments')`), never `page.goto` — a page load signs the user out.
- Find things the way a user does: `getByRole('button', { name: 'Confirm & assign' })`, `getByLabel('Unit code *')`.
  If a control cannot be found that way, give it a proper label in the app rather than using a CSS selector.
- Make your own data (a new customer, a new email with `uniqueEmail()`); do not rely on what another test left behind,
  except inside one `test.describe.serial` chain.
- Check money and status through the API as well (`apiAs(baseURL, ACCOUNTS.staff)`), not only on screen.
- Dates: pass a date to the billing run (`/api/billing/run?date=…`) instead of waiting for time to pass.
- Demo accounts (`ACCOUNTS`) use password `Demo@123`; they exist only in the local demo and E2E databases.
