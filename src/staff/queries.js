import { useQuery } from '@tanstack/react-query';
import {
    contractsApi, facilitiesApi, invoicesApi, moveOutRequestsApi, reservationsApi, shiftsApi, staffApi,
    staffTasksApi, storageUnitsApi, ticketQueueApi, unitTypesApi,
} from '../api/generated';

const PAGE_SIZE = 100; // the backend's PagedResult cap

/** Every page of a paged list endpoint, so counts and charts are not cut off at 100 rows. */
export async function fetchAll(list, params = {}) {
    const items = [];
    for (let page = 1; ; page += 1) {
        const result = await list({ ...params, page, pageSize: PAGE_SIZE });
        items.push(...(result.items ?? []));
        if (items.length >= (result.totalCount ?? 0) || !result.items?.length) return items;
    }
}

const all = (key, list, params) => ({ queryKey: [key, 'all', params ?? {}], queryFn: () => fetchAll(list, params) });

export const useFacilities = () => useQuery(all('facilities', facilitiesApi.list));
export const useUnits = (params) => useQuery(all('storage-units', storageUnitsApi.list, params));
export const useUnitTypes = () => useQuery({ queryKey: ['unit-types'], queryFn: () => unitTypesApi.list() });
export const useReservations = (params) => useQuery(all('reservations', reservationsApi.list, params));
export const useContracts = (params) => useQuery(all('contracts', contractsApi.list, params));
export const useInvoices = (params) => useQuery(all('invoices', invoicesApi.list, params));
export const useTickets = (params) => useQuery(all('tickets', ticketQueueApi.list, params));
export const useMoveOuts = (params) => useQuery(all('move-outs', moveOutRequestsApi.list, params));
export const useShifts = (params) => useQuery(all('shifts', shiftsApi.list, params));
export const useTasks = (params) => useQuery(all('staff-tasks', staffTasksApi.list, params));
export const useStaff = (params, enabled = true) => useQuery({ ...all('staff', staffApi.list, params), enabled });

/** Badge tone per status value, shared by every admin table. */
export const TONE = {
    Available: '', Active: '', Paid: '', Completed: '', Done: '', Resolved: '', Confirmed: '', CheckedIn: '', Succeeded: '', Good: '',
    Reserved: 'low', Pending: 'low', Draft: 'low', Issued: 'low', Requested: 'low', Approved: 'low', Inspected: 'low', InProgress: 'low',
    New: 'low', Scheduled: 'low', ToDo: 'low', WaitingForCustomer: 'low', PendingMoveOut: 'low', MinorDamage: 'low', Open: 'low',
    Occupied: 'info', Maintenance: 'none', Overdue: 'none', Suspended: 'none', Rejected: 'none', Cancelled: 'muted', Expired: 'muted',
    Closed: 'muted', Terminated: 'muted', Retired: 'muted', Superseded: 'muted', WrittenOff: 'muted', Inactive: 'muted', MajorDamage: 'none',
    Urgent: 'none', High: 'low', Normal: '', Low: 'muted',
};

/** "WaitingForCustomer" → "Waiting for customer". */
export const humanize = (value = '') => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()).replace(/ (\w)/g, (m) => m.toLowerCase());
