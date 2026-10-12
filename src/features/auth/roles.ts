/** Role names exactly as the backend issues them in the login response and the JWT `role` claim. */
export const Roles = {
  StorageCustomer: 'StorageCustomer',
  FacilityStaff: 'FacilityStaff',
  FacilityManager: 'FacilityManager',
  BusinessOperationsManager: 'BusinessOperationsManager',
  SystemAdministrator: 'SystemAdministrator',
} as const

export type Role = (typeof Roles)[keyof typeof Roles]

/** Everyone who signs in through the admin portal. */
export const ADMIN_PORTAL_ROLES: Role[] = [
  Roles.FacilityStaff,
  Roles.FacilityManager,
  Roles.BusinessOperationsManager,
  Roles.SystemAdministrator,
]
