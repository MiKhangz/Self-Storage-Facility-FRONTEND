/** [tone, label] for a support ticket status badge. */
const TICKET_BADGE = {
    New: ['low', 'Mới gửi'], InProgress: ['low', 'Đang xử lý'], WaitingForCustomer: ['none', 'Chờ bạn phản hồi'],
    Resolved: ['', 'Đã giải quyết'], Closed: ['muted', 'Đã đóng'],
};
export const ticketBadge = (status) => TICKET_BADGE[status] ?? ['', status];

export const PRIORITY_TONE = { Low: '', Normal: '', High: 'low', Urgent: 'none' };

export const formatDateTime = (iso) => (iso
    ? new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—');
