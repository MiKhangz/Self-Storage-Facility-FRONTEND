/**
 * Plain words for activity log rows. The backend records "METHOD Controller.Action" plus the controller as the entity;
 * this turns that into "Booked a unit" and "Booking #41". Anything not listed falls back to the raw text.
 */

/** Controller.Action → what happened. */
export const ACTIONS = {
    'Auth.Login': 'Signed in', 'Auth.Logout': 'Signed out',
    'AccessCodes.Revoke': 'Revoked an access code',
    'Billing.Run': 'Ran monthly billing',
    'CheckIns.CheckIn': 'Checked a customer in', 'CheckIns.CheckOut': 'Checked a customer out',
    'CheckIns.MarkLeft': 'Marked a customer as left', 'CheckIns.Find': 'Looked up an access code',
    'Contracts.Create': 'Drafted a contract', 'Contracts.Sign': 'Signed the contract online',
    'Contracts.SignAtDesk': 'Recorded a paper signature', 'Contracts.Terminate': 'Terminated a contract',
    'Contracts.IssueAccessCode': 'Issued an access code', 'Contracts.RequestAccessCode': 'Asked for a new access code',
    'DepositRefunds.MarkPaid': 'Paid back a deposit',
    'Facilities.Create': 'Added a facility', 'Facilities.Update': 'Edited a facility',
    'Facilities.Deactivate': 'Deactivated a facility', 'Facilities.Activate': 'Reactivated a facility',
    'Facilities.CreateFloor': 'Added a floor', 'Floors.Update': 'Edited a floor', 'Floors.Delete': 'Deleted a floor',
    'Handovers.Create': 'Completed a handover', 'Handovers.Cancel': 'Cancelled a handover',
    'Invoices.PayOnline': 'Started an online payment', 'Invoices.PayManual': 'Recorded a payment at the desk',
    'Invoices.Adjust': 'Adjusted an invoice', 'Invoices.SendReminder': 'Sent a payment reminder',
    'MaintenanceOrders.Create': 'Opened a maintenance order', 'MaintenanceOrders.ChangeStatus': 'Updated a maintenance order',
    'OverdueCases.LockOut': 'Locked out an overdue renter', 'OverdueCases.RestoreAccess': 'Restored access',
    'Payments.Refund': 'Refunded a payment', 'Payments.GatewayCallback': 'Payment gateway reported a result',
    'Payments.SimulateSuccess': 'Confirmed a payment (test gateway)',
    'PricingPolicies.Create': 'Created a price version', 'PricingPolicies.Update': 'Edited a price version',
    'PricingPolicies.CopyToDraft': 'Copied prices into a draft', 'PricingPolicies.DeleteDraft': 'Deleted a price draft',
    'PricingPolicies.Activate': 'Put a price version live', 'PricingPolicies.UpsertUnitPrice': 'Set a unit price',
    'PricingPolicies.CreateFeeType': 'Added a fee', 'PricingPolicies.UpdateFeeType': 'Edited a fee', 'PricingPolicies.DeleteFeeType': 'Deleted a fee',
    'Profile.Update': 'Edited their profile', 'Profile.ChangePassword': 'Changed their password',
    'Profile.UpdateNotificationSettings': 'Changed notification settings',
    'Renewals.Create': 'Asked to renew', 'Renewals.Approve': 'Approved a renewal', 'Renewals.Reject': 'Declined a renewal',
    'Reservations.WalkIn': 'Booked for a walk-in customer', 'Reservations.Create': 'Booked a unit',
    'Reservations.Cancel': 'Cancelled a booking', 'Reservations.NoShow': 'Marked a booking as no-show',
    'Reservations.AssignUnit': 'Assigned a unit', 'Reservations.ChangeUnit': 'Changed the assigned unit',
    'Returns.Create': 'Asked to hand back a unit', 'Returns.Approve': 'Approved a hand-back',
    'Returns.Inspect': 'Inspected a returned unit', 'Returns.SettleDeposit': 'Settled the deposit',
    'Shifts.Create': 'Added a shift', 'Shifts.Update': 'Edited a shift', 'Shifts.Delete': 'Deleted a shift',
    'Staff.Create': 'Created a staff account', 'Staff.Update': 'Edited a staff account', 'Staff.SetFacilities': 'Changed a staff member\'s facilities',
    'StaffTasks.Create': 'Assigned a task', 'StaffTasks.ChangeStatus': 'Updated a task',
    'StorageUnits.Create': 'Added a unit', 'StorageUnits.Update': 'Edited a unit',
    'StorageUnits.Retire': 'Retired a unit', 'StorageUnits.Restore': 'Brought a unit back',
    'SupportTickets.Create': 'Opened a support request', 'SupportTickets.PostMessage': 'Replied on a support request',
    'TicketQueue.Assign': 'Assigned a support request', 'TicketQueue.ChangeStatus': 'Updated a support request',
    'UnitTypes.Create': 'Added a unit size', 'UnitTypes.Update': 'Edited a unit size', 'UnitTypes.Delete': 'Deleted a unit size',
};

/** The record each part of the system acts on, and its page in the staff portal when it has one. */
const RECORDS = {
    AccessCodes: ['Access code'], CheckIns: ['Visit'], Contracts: ['Contract'], DepositRefunds: ['Deposit refund'],
    Facilities: ['Facility', (id) => `/admin/facilities/${id}`], Floors: ['Floor'], Handovers: ['Handover'], Invoices: ['Invoice'],
    MaintenanceOrders: ['Maintenance order'], OverdueCases: ['Overdue case'], Payments: ['Payment'], PricingPolicies: ['Price version'],
    Renewals: ['Renewal'], Reservations: ['Booking'], Returns: ['Hand-back'], Shifts: ['Shift'], Staff: ['Staff account'],
    StaffTasks: ['Task'], StorageUnits: ['Unit'], UnitTypes: ['Unit size'],
    SupportTickets: ['Support request', (id) => `/admin/tickets/${id}`], TicketQueue: ['Support request', (id) => `/admin/tickets/${id}`],
};

/** The "Action type" filter: each choice lists the parts of the system (as recorded) it covers. */
export const AREAS = [
    { value: 'User,Auth', label: 'Sign-ins & sign-outs' },
    { value: 'Reservations', label: 'Bookings' },
    { value: 'Contracts,AccessCodes,Renewals', label: 'Contracts & access codes' },
    { value: 'Handovers,Returns,DepositRefunds', label: 'Handovers & hand-backs' },
    { value: 'CheckIns', label: 'Check-ins & check-outs' },
    { value: 'Invoices,Payments,Billing,OverdueCases', label: 'Payments & invoices' },
    { value: 'Facilities,Floors,StorageUnits,UnitTypes,MaintenanceOrders', label: 'Facilities & units' },
    { value: 'PricingPolicies', label: 'Pricing' },
    { value: 'Staff,Shifts,StaffTasks', label: 'Staff & shifts' },
    { value: 'SupportTickets,TicketQueue', label: 'Support requests' },
    { value: 'Profile', label: 'Profile & settings' },
];

/**
 * @param {{ action?: string, entityName?: string|null, entityId?: string|null }} row
 * @returns {{ label: string, raw: string, record: string|null, recordId: string|null, link: string|null }}
 */
export function describe(row) {
    const raw = String(row?.action ?? '');
    const key = raw === 'LOGIN' ? 'Auth.Login' : raw.replace(/^(POST|PUT|PATCH|DELETE)\s+/, '');
    const [noun, page] = RECORDS[row?.entityName] ?? [];
    const id = row?.entityId || null;
    return {
        label: ACTIONS[key] ?? raw,
        raw,
        record: noun ?? null,
        recordId: noun ? id : null,
        link: noun && id && page ? page(id) : null,
    };
}

/** The loopback address means the request came from the computer the server runs on. */
export const isThisComputer = (ip) => ['::1', '127.0.0.1', '::ffff:127.0.0.1'].includes(ip ?? '');
