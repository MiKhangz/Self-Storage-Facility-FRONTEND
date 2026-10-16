import { useQuery } from '@tanstack/react-query';
import { formatDate } from '../components/format.js';
import { contractsApi, invoicesApi, reservationsApi, ticketQueueApi } from '../../api/generated';

// ponytail: one page of 50 covers a customer's own records; add paging if anyone ever rents more.
const PAGE = { page: 1, pageSize: 50 };

// The backend filters every list to the signed-in customer's own rows.
export const useMyContracts = () => useQuery({ queryKey: ['contracts', PAGE], queryFn: () => contractsApi.list(PAGE) });
export const useMyReservations = () => useQuery({ queryKey: ['reservations', PAGE], queryFn: () => reservationsApi.list(PAGE) });
export const useMyInvoices = () => useQuery({ queryKey: ['invoices', PAGE], queryFn: () => invoicesApi.list(PAGE) });
export const useMyTickets = () => useQuery({ queryKey: ['tickets', PAGE], queryFn: () => ticketQueueApi.list(PAGE) });

export const OPEN_INVOICE = ['Issued', 'Overdue'];
export const OPEN_TICKET = ['New', 'InProgress', 'WaitingForCustomer'];
export const AWAITING_CHECK_IN = ['Pending', 'Confirmed'];
// A contract the customer still holds; Draft is signed-or-signing before handover.
export const LIVE_CONTRACT = ['Draft', 'Active', 'PendingMoveOut', 'Overdue', 'Suspended'];

/** Share of the rental period already used, 0–100. */
export function periodUsed(startIso, endIso, todayIso) {
    const day = (iso) => Date.parse(`${iso}T00:00:00Z`);
    const total = day(endIso) - day(startIso);
    if (total <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round(((day(todayIso) - day(startIso)) / total) * 100)));
}

const INVOICE_BADGE = { Paid: ['', 'Đã thanh toán'], Overdue: ['none', 'Quá hạn'], WrittenOff: ['none', 'Đã xóa nợ'] };

/** [tone, label] for an invoice status badge; an open invoice shows its due date. */
export const invoiceBadge = (inv) => INVOICE_BADGE[inv.status] ?? ['low', `Hạn ${formatDate(inv.dueDate)}`];

/** [tone, label] per contract status, in the customer's words. */
export const CONTRACT_BADGE = {
    Draft: ['low', 'Chờ bàn giao'], Active: ['', 'Đang thuê'], PendingMoveOut: ['low', 'Đang trả kho'],
    Overdue: ['none', 'Quá hạn thanh toán'], Suspended: ['none', 'Tạm khóa ra vào'],
    Closed: ['muted', 'Đã kết thúc'], Terminated: ['muted', 'Đã chấm dứt'],
};
