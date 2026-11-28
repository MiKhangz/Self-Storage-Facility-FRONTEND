import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { contractsApi } from '../../api/generated';
import { useAuth } from '../../features/auth/AuthContext';
import Icon from '../components/Icon.jsx';
import { formatDate, formatVnd, rentalEndDate, todayIso } from '../components/format.js';
import {
    AWAITING_CHECK_IN, CONTRACT_BADGE, LIVE_CONTRACT, OPEN_INVOICE, OPEN_TICKET, invoiceBadge,
    periodUsed, useMyContracts, useMyDepositRefunds, useMyInvoices, useMyReservations, useMyTickets,
} from './queries.js';
import './MyStoragePage.css';
import { useT } from '../../i18n/I18n.jsx';
import { formatDateTime } from '../support/support.js';

function Stat({ icon, label, value, note }) {
    return (
        <div className="se-card se-stat">
            <span className="se-icon-tile sm"><Icon name={icon} size={16} /></span>
            <span className="se-stat-label">{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
        </div>
    );
}

const STATUS_OPTIONS = ['Pending', 'Draft', 'Active', 'PendingReturn', 'Overdue', 'Suspended', 'Overstay', 'PendingRefund'];

/** U09: the signed-in customer's units, what is due and recent invoices. */
export default function MyStoragePage() {
    const { session } = useAuth();
    const t = useT();
    const [statusFilter, setStatusFilter] = useState('ALL');
    const today = todayIso();
    const contracts = useMyContracts();
    const reservations = useMyReservations();
    const invoices = useMyInvoices();
    const tickets = useMyTickets();
    const depositRefunds = useMyDepositRefunds();

    const pendingRefundByRes = Object.fromEntries(
        (depositRefunds.data?.items ?? [])
            .filter((d) => d.status === 'Pending')
            .map((d) => [d.reservationId, d]),
    );
    const allContracts = contracts.data?.items ?? [];
    // Keep closed/terminated contracts visible on the customer page until their deposit refund is resolved (Paid).
    const live = allContracts.filter((c) => LIVE_CONTRACT.includes(c.status) || !!pendingRefundByRes[c.reservationId]);
    const allReservations = reservations.data?.items ?? [];
    const contractByRes = Object.fromEntries(allContracts.map((c) => [c.reservationId, c]));
    // Keep cancelled/expired reservations visible on the customer page until their deposit refund is resolved (Paid).
    const waiting = allReservations.filter((r) =>
        (AWAITING_CHECK_IN.includes(r.status) && !r.contractId)
        || (['Cancelled', 'Expired'].includes(r.status) && !contractByRes[r.reservationId] && !!pendingRefundByRes[r.reservationId]),
    );
    const reservationOf = Object.fromEntries(allReservations.map((r) => [r.reservationId, r]));
    const unitOf = Object.fromEntries(allContracts.map((c) => [c.contractId, c.unitCode]));
    const allInvoices = invoices.data?.items ?? [];
    const due = allInvoices.filter((i) => OPEN_INVOICE.includes(i.status)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const next = due[0];
    const openTickets = (tickets.data?.items ?? []).filter((t) => OPEN_TICKET.includes(t.status));
    const deposit = live.filter((c) => c.status !== 'Draft').reduce((sum, c) => sum + (c.depositAmount ?? 0), 0);

    const codes = useQueries({
        queries: live.filter((c) => c.status === 'Active').map((c) => ({
            queryKey: ['contracts', c.contractId, 'access-code'],
            queryFn: () => contractsApi.accessCode(c.contractId),
        })),
    });
    const codeOf = Object.fromEntries(codes.map((q) => [q.data?.contractId, q.data]));

    const failed = [contracts, reservations, invoices].some((q) => q.isError);
    const firstName = session?.fullName?.trim().split(/\s+/).at(-1);

    return (
        <>
            <div className="se-account-title">
                <div><h1>{t('Xin chào, {name}', { name: firstName })}</h1><p>{t('Mọi thông tin về các kho bạn đang thuê.')}</p></div>
                <Link to="/booking" className={`se-btn ${next ? 'se-btn-outline' : 'se-btn-primary'}`}><Icon name="box" size={16} /> {t('Thuê thêm kho')}</Link>
            </div>

            {failed && <div className="se-alert" role="alert">{t('Một số thông tin chưa tải được. Vui lòng tải lại trang.')}</div>}

            {next && (
                <div className={`se-due${next.status === 'Overdue' ? ' overdue' : ''}`}>
                    <Icon name="clock" size={20} />
                    <div>
                        <strong>{t(next.status === 'Overdue' ? 'Quá hạn: hóa đơn {number}' : 'Sắp đến hạn: hóa đơn {number}', { number: next.invoiceNumber })} · {formatDate(next.dueDate)}</strong>
                        <small>{t(next.status === 'Overdue' ? 'Thanh toán {amount} sớm để tránh bị tính thêm phí trễ hạn.' : 'Thanh toán {amount} trước hạn để không bị tính phí trễ hạn.', { amount: formatVnd(next.outstandingAmount) })}</small>
                    </div>
                    <Link to="/payments" className="se-btn se-btn-primary se-btn-sm">{t('Thanh toán ngay')}</Link>
                </div>
            )}

            <div className="se-stats">
                <Stat icon="box" label={t('Kho đang thuê')} value={live.filter((c) => c.status !== 'Draft').length} note={t('{n} kho chờ nhận', { n: waiting.length + live.filter((c) => c.status === 'Draft').length })} />
                <Stat icon="card" label={t('Khoản cần thanh toán')} value={next ? formatVnd(next.outstandingAmount) : '—'} note={next ? t('Hạn {date}', { date: formatDate(next.dueDate) }) : t('Không có khoản nào đến hạn')} />
                <Stat icon="chat" label={t('Yêu cầu đang mở')} value={openTickets.length} note={openTickets[0]?.subject ?? t('Không có yêu cầu nào')} />
                <Stat icon="shield" label={t('Tiền cọc đang giữ')} value={formatVnd(deposit)} note={t('Được hoàn lại khi trả kho')} />
            </div>

            <div className="se-section-row">
                <h2>{t('Kho của tôi')}</h2>
                <label className="se-field se-status-filter">
                    <span className="sr-only">{t('Trạng thái')}</span>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label={t('Trạng thái')}>
                        <option value="ALL">{t('Tất cả')} ({live.length + waiting.length})</option>
                        {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{t(s === 'Pending' ? 'Đang chờ xếp kho' : s === 'PendingRefund' ? 'Đang chờ hoàn tiền' : CONTRACT_BADGE[s][1])}</option>
                        ))}
                    </select>
                </label>
            </div>
            <div className="se-units">
                {live.filter((c) => {
                    const awaitingRefund = !LIVE_CONTRACT.includes(c.status) && !!pendingRefundByRes[c.reservationId];
                    if (statusFilter === 'ALL') return true;
                    if (statusFilter === 'PendingRefund') return awaitingRefund;
                    return c.status === statusFilter;
                }).map((c) => {
                    const pendingRefund = pendingRefundByRes[c.reservationId];
                    const awaitingRefund = !LIVE_CONTRACT.includes(c.status) && !!pendingRefund;
                    const r = reservationOf[c.reservationId];
                    const code = codeOf[c.contractId];
                    const used = periodUsed(c.startDate, c.endDate, today);
                    const offered = c.status === 'Draft' && r?.proposedUnitCode;
                    const needsAppointment = c.status === 'Draft' && r?.status === 'Confirmed' && r?.depositStatus === 'Paid' && !r?.handoverSlot;
                    const [tone, label] = awaitingRefund
                        ? ['low', 'Đang chờ hoàn tiền']
                        : needsAppointment
                            ? ['low', 'Chọn thời gian nhận kho']
                            : CONTRACT_BADGE[c.status];
                    return (
                        <article key={c.contractId} className={`se-card se-unit${needsAppointment ? ' has-dot' : ''}`}>
                            {needsAppointment && <span className="se-red-dot" title={t('Hãy đặt thời gian hẹn nhận kho trong đơn đặt kho.')} aria-label={t('Hãy đặt thời gian hẹn nhận kho trong đơn đặt kho.')} />}
                            <header>
                                <span className="se-unit-icon"><Icon name="box" size={20} /></span>
                                <div><strong>{t('Kho')} {c.unitCode}</strong><small>{r?.unitTypeName ?? ''}</small></div>
                                <span className={`se-badge ${tone}`}>{t(label)}</span>
                            </header>
                            <dl>
                                <div><dt>{t('Số hợp đồng')}</dt><dd>{c.contractNumber}</dd></div>
                                <div><dt>{t('Cơ sở')}</dt><dd>{r?.facilityName ?? '—'}</dd></div>
                                <div><dt>{t('Mã ra vào')}</dt><dd>{code?.isActive ? t('Đang dùng · hết hạn {date}', { date: formatDate(code.expiresAt) }) : t(c.status === 'Draft' ? 'Cấp khi nhận kho' : 'Chưa có mã đang dùng')}</dd></div>
                                <div><dt>{t('Thời hạn thuê')}</dt><dd>{formatDate(c.startDate)} → {formatDate(c.endDate)}</dd></div>
                                {pendingRefund && <div><dt>{t('Tiền hoàn lại')}</dt><dd>{formatVnd(pendingRefund.amount)} · {t('Đang chờ hoàn')}</dd></div>}
                            </dl>
                            {offered && <p className="se-alert info">{t('Kho cần đổi sang {code}: hãy xác nhận trong đơn đặt kho.', { code: r.proposedUnitCode })}</p>}
                            <p className="se-unit-progress-label">{c.status === 'Draft' ? t('Bắt đầu tính sau khi nhận kho') : t('Đã dùng {used}% thời hạn thuê', { used })}</p>
                            <div className="se-progress"><span style={{ width: `${c.status === 'Draft' ? 1 : used}%` }} /></div>
                            <div className="se-unit-actions">
                                {offered && <Link to={`/booking/confirmed/${r.reservationId}`} className="se-btn se-btn-primary se-btn-sm">{t('Xem đơn đặt kho')}</Link>}
                                <Link to={`/my-storage/units/${c.contractId}`} className="se-btn se-btn-outline se-btn-sm">{t('Xem chi tiết')}</Link>
                                <Link to={`/support/new?contractId=${c.contractId}`} className="se-btn se-btn-ghost se-btn-sm">{t('Báo sự cố')}</Link>
                            </div>
                        </article>
                    );
                })}
                {waiting.filter((r) => {
                    const awaitingRefund = ['Cancelled', 'Expired'].includes(r.status) && !!pendingRefundByRes[r.reservationId];
                    if (statusFilter === 'ALL') return true;
                    if (statusFilter === 'PendingRefund') return awaitingRefund;
                    if (statusFilter === 'Pending') return !awaitingRefund && ['Pending', 'PENDING_UNIT_SELECTION'].includes(r.status);
                    if (statusFilter === 'Draft') return !awaitingRefund && r.status === 'Confirmed';
                    return false;
                }).map((r) => {
                    const pendingRefund = pendingRefundByRes[r.reservationId];
                    const awaitingRefund = ['Cancelled', 'Expired'].includes(r.status) && !!pendingRefund;
                    const needsAppointment = !awaitingRefund && r.status === 'Confirmed' && r.depositStatus === 'Paid' && !r.handoverSlot;
                    return (
                        <article key={`r${r.reservationId}`} className={`se-card se-unit${needsAppointment ? ' has-dot' : ''}`}>
                            {needsAppointment && <span className="se-red-dot" title={t('Hãy đặt thời gian hẹn nhận kho trong đơn đặt kho.')} aria-label={t('Hãy đặt thời gian hẹn nhận kho trong đơn đặt kho.')} />}
                            <header>
                                <span className="se-unit-icon"><Icon name="box" size={20} /></span>
                                <div><strong>{r.unitCode ? `${t('Kho')} ${r.unitCode}` : t('Kho đang chờ xếp')}</strong><small>{r.unitTypeName}</small></div>
                                <span className="se-badge low">{t(awaitingRefund ? 'Đang chờ hoàn tiền' : needsAppointment ? 'Chọn thời gian hẹn nhận kho' : r.status === 'Confirmed' ? 'Chờ nhận kho' : r.status === 'PENDING_UNIT_SELECTION' ? 'Đang chờ chọn kho' : 'Đang chờ xếp kho')}</span>
                            </header>
                            <dl>
                                <div><dt>{t('Cơ sở')}</dt><dd>{r.facilityName}</dd></div>
                                <div><dt>{t('Mã ra vào')}</dt><dd>{awaitingRefund ? '—' : t('Được cấp khi nhận kho ngày {date}', { date: formatDate(r.moveInDate) })}</dd></div>
                                <div><dt>{t('Thời hạn thuê')}</dt><dd>{formatDate(r.moveInDate)} → {formatDate(rentalEndDate(r.moveInDate, r.rentalMonths))}</dd></div>
                                {pendingRefund && <div><dt>{t('Tiền hoàn lại')}</dt><dd>{formatVnd(pendingRefund.amount)} · {t('Đang chờ hoàn')}</dd></div>}
                            </dl>
                            {!awaitingRefund && r.proposedUnitCode && (
                                <p className="se-alert info">{t('Kho cần đổi sang {code}: hãy xác nhận trong đơn đặt kho.', { code: r.proposedUnitCode })}</p>
                            )}
                            <p className="se-unit-progress-label">{awaitingRefund ? t('Kho sẽ ẩn sau khi hoàn tiền hoàn tất') : r.handoverSlot ? t('thời gian hẹn nhận kho: {time}', { time: formatDateTime(r.handoverSlot) }) : t('Bắt đầu tính sau khi nhận kho')}</p>
                            <div className="se-progress"><span style={{ width: '1%' }} /></div>
                            <div className="se-unit-actions">
                                <Link to={`/booking/confirmed/${r.reservationId}`} className="se-btn se-btn-outline se-btn-sm">{t('Xem đơn đặt kho')}</Link>
                                {r.ticketId && !awaitingRefund && <Link to={`/support/requests/${r.ticketId}`} className="se-btn se-btn-primary se-btn-sm">{t('Trò chuyện với nhân viên')}</Link>}
                                {awaitingRefund && <Link to="/payments" className="se-btn se-btn-primary se-btn-sm">{t('Xem hoàn tiền')}</Link>}
                            </div>
                        </article>
                    );
                })}
                {!live.length && !waiting.length && !contracts.isLoading && !reservations.isLoading ? (
                    <div className="se-card se-empty">{t('Bạn chưa thuê kho nào.')} <Link to="/booking" className="se-link">{t('Đặt kho đầu tiên')}</Link></div>
                ) : statusFilter !== 'ALL'
                && !live.some((c) => statusFilter === 'PendingRefund' ? (!LIVE_CONTRACT.includes(c.status) && !!pendingRefundByRes[c.reservationId]) : c.status === statusFilter)
                && !waiting.some((r) => {
                    const awaitingRefund = ['Cancelled', 'Expired'].includes(r.status) && !!pendingRefundByRes[r.reservationId];
                    if (statusFilter === 'PendingRefund') return awaitingRefund;
                    if (statusFilter === 'Pending') return !awaitingRefund && r.status === 'Pending';
                    if (statusFilter === 'Draft') return !awaitingRefund && r.status === 'Confirmed';
                    return false;
                })
                && !contracts.isLoading && !reservations.isLoading && (
                    <div className="se-card se-empty">{t('Không có kho nào ở trạng thái này.')}</div>
                )}
            </div>

            <h2>{t('Hóa đơn gần đây')}</h2>
            <div className="se-card se-table-wrap">
                <table className="se-table se-stack">
                    <thead><tr><th>{t('Ngày lập')}</th><th>{t('Hóa đơn')}</th><th>{t('Kho')}</th><th>{t('Nội dung')}</th><th>{t('Số tiền')}</th><th>{t('Trạng thái')}</th></tr></thead>
                    <tbody>
                        {allInvoices.slice(0, 5).map((inv) => {
                            const [tone, label] = invoiceBadge(inv, t);
                            return (
                                <tr key={inv.invoiceId}>
                                    <td data-label={t('Ngày lập')}>{formatDate(inv.issueDate)}</td>
                                    <td data-label={t('Hóa đơn')}>{inv.invoiceNumber}</td>
                                    <td data-label={t('Kho')}>{unitOf[inv.contractId] ?? '—'}</td>
                                    <td data-label={t('Nội dung')}>{inv.items?.[0]?.description ?? '—'}</td>
                                    <td data-label={t('Số tiền')} className="price">{formatVnd(inv.totalAmount)}</td>
                                    <td data-label={t('Trạng thái')}><span className={`se-badge ${tone}`}>{t(label)}</span></td>
                                </tr>
                            );
                        })}
                        {!allInvoices.length && <tr><td colSpan={6} className="se-empty">{t(invoices.isLoading ? 'Đang tải hóa đơn…' : 'Bạn chưa có hóa đơn nào.')}</td></tr>}
                    </tbody>
                </table>
            </div>
        </>
    );
}
