import { Roles } from '../features/auth/roles';

const { SystemAdministrator: SA, BusinessOperationsManager: BO, FacilityManager: FM, FacilityStaff: ST } = Roles;

export const ROLE_INFO = [
    { role: SA, short: 'SA', title: 'System Administrator', text: 'Staff accounts, roles and permissions' },
    { role: BO, short: 'BO', title: 'Business Operations Manager', text: 'All facilities, pricing and deposit settlement' },
    { role: FM, short: 'FM', title: 'Facility Manager', text: 'Units, contracts, shifts and tickets at their facilities' },
    { role: ST, short: 'ST', title: 'Facility Staff', text: 'Handover, check-ins, returns and support' },
];

/**
 * What each role may do, mirroring the [Authorize(Roles = ...)] rules on the backend controllers.
 * Keep in step with the API: the server enforces these, this table only explains them.
 */
export const PERMISSIONS = [
    { group: 'Units & facilities', feature: 'View facilities, units and dashboards', roles: [SA, BO, FM, ST] },
    { group: 'Units & facilities', feature: 'Edit unit sizes', roles: [BO] },
    { group: 'Customers & contracts', feature: 'Assign units to reservations', roles: [FM, ST] },
    { group: 'Customers & contracts', feature: 'Handover', roles: [FM, ST] },
    { group: 'Customers & contracts', feature: 'Check customers in and out', roles: [FM, ST] },
    { group: 'Customers & contracts', feature: 'Terminate a contract', roles: [FM] },
    { group: 'Customers & contracts', feature: 'Export contracts', roles: [FM, ST] },
    { group: 'Money', feature: 'Record a payment', roles: [FM, ST] },
    { group: 'Money', feature: 'Settle a deposit refund', roles: [BO] },
    { group: 'Money', feature: 'Change prices and policies', roles: [BO, SA] },
    { group: 'Operations', feature: 'Approve returns and inspect returned units', roles: [FM, ST] },
    { group: 'Operations', feature: 'Reply to support tickets', roles: [FM, ST] },
    { group: 'Operations', feature: 'Assign support tickets', roles: [FM] },
    { group: 'Operations', feature: 'Plan shifts', roles: [SA, FM] },
    { group: 'Operations', feature: 'Assign staff tasks', roles: [FM] },
    { group: 'Operations', feature: 'View gate access logs', roles: [FM] },
    { group: 'System', feature: 'Manage staff accounts', roles: [SA] },
    { group: 'System', feature: 'Assign staff to facilities', roles: [SA, FM] },
];
