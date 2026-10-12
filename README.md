# StorEase — Frontend

React 18 + Vite + TypeScript. Talks to the backend in `Self-Storage-Facility-BACKEND`.

## Run

1. Start the backend (`dotnet run --project StorEase.Api --launch-profile https` in its `BE/` folder).
2. Here:
   ```bash
   npm install
   npm run dev
   ```
3. Open http://localhost:5173 — it lands on the admin sign-in. Demo accounts use password `Demo@123`
   (`staff@storease.vn`, `manager@storease.vn`, `ops@storease.vn`, `admin@storease.vn`).

`npm run dev` forwards every `/api/...` request to the backend at `https://localhost:7001`, so the browser
never sees the backend's self-signed certificate and CORS does not come into play.

## Calling the API

All 70 backend operations are generated as typed functions in `src/api/generated/`, one file per backend
controller. Use them with TanStack Query:

```tsx
import { useQuery, useMutation } from '@tanstack/react-query'
import { reservationsApi } from '../api/generated'
import { errorMessage } from '../api/axiosClient'

const reservations = useQuery({
  queryKey: ['reservations', { status: 'Pending', page: 1 }],
  queryFn: () => reservationsApi.list({ status: 'Pending', page: 1 }),
})

const assign = useMutation({
  mutationFn: (unitId: number) => reservationsApi.assignUnit(reservationId, { storageUnitId: unitId }),
})
// show errorMessage(assign.error) on failure — it reads the API's ProblemDetails title or field errors
```

Request and response types come from `components['schemas']` in `src/api/generated/schema.d.ts` and mirror the
backend DTOs exactly — do not re-shape field names. API field names are listed in the backend's
`docs/api-endpoints.md`.

**When the backend changes**, with it running: `npm run api:gen`. That refreshes `openapi.json` and the
generated files. Never edit `src/api/generated/` by hand. `npm run api:gen -- --offline` regenerates from the
committed `openapi.json`.

## Auth

`useAuth()` from `src/features/auth/AuthContext.tsx` gives `session`, `login`, `logout`. The token is held in
memory only — **never put it in localStorage** (the assignment is marked on this), so a page reload signs
the user out. Wrap protected routes in `<RequireAuth roles={[...]} loginPath="...">`; role names are in
`src/features/auth/roles.ts`. A 401 from any call ends the session.

## Routes so far

| Path | Screen | Who |
|---|---|---|
| `/admin/login` | Admin sign-in | anyone |
| `/admin/facilities` | Facility overview | staff, manager, operations, admin |
