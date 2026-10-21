# Active Storage & Access endpoint audit

## Existing backend endpoints

| Purpose | Method and URL | Request / response | Required role |
| --- | --- | --- | --- |
| Active rentals | `GET /api/reservations?status=CheckedIn&page&pageSize&facilityId&search` | Query filters; `PagedResult<ReservationDto>` | Authenticated; staff are facility-scoped |
| Rental contract | `GET /api/contracts/{id}` | No body; `ContractDto` | Authenticated; owner or staff scope |
| Access code summary | `GET /api/contracts/{id}/access-code` | No body; `AccessCodeSummaryDto` | Authenticated |
| Identity/deposit checklist | `GET /api/reservations/{id}/check-in` | No body; `CheckInChecklistDto` | Facility Staff / Facility Manager |
| Unit visit history | `GET /api/unit-visits?contractId&page&pageSize` | Query filters; paged `UnitVisitDto` | Authenticated; staff facility-scoped |
| Visit check-in | `POST /api/unit-visits/check-in` | `{ contractId, note? }`; ContractId > 0, Note ≤ 200 chars; `UnitVisitDto` | Facility Staff / Facility Manager |
| Visit check-out | `POST /api/unit-visits/{id}/check-out` | No body; updated `UnitVisitDto` | Facility Staff / Facility Manager |
| Access event log | `GET /api/access-logs?storageUnitId&customerId&from&to&page&pageSize` | Query filters; paged `AccessLogDto` | Facility Manager only |
| Check-in evidence | `GET /api/check-ins?status=Completed&page&pageSize` | Query filters; paged check-in DTO | Facility Staff / Facility Manager |
| Payment status | `GET /api/invoices?page&pageSize` | Query filters; paged `InvoiceDto` | Authenticated; facility-scoped for staff |

## Missing backend endpoints (mocked by `api.js`)

- Authorized-person list and edit for a rental contract.
- Granting a visit before the customer enters (the `Granted` status).
- Visit duration, expected check-out, extension, and overtime persistence. `UnitVisitDto` stores check-in/out timestamps and staff only.
- A customer account-suspension lookup. The UI uses the contract `Suspended` status as the access-suspension signal.

`USE_MOCK_ACTIVE_STORAGE` enables the in-memory preview. Mock grants, authorized people, duration extensions, and overtime reset on reload. Existing visit check-in/out calls still use the backend.
