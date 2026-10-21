import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { contractsApi } from '../../api/generated';
import { useAuth } from '../../features/auth/AuthContext';
import Icon from '../components/Icon.jsx';
import { formatDate, formatVnd, rentalEndDate, todayIso } from '../components/format.js';
import {
    AWAITING_CHECK_IN, CONTRACT_BADGE, LIVE_CONTRACT, OPEN_INVOICE, OPEN_TICKET, invoiceBadge,
    periodUsed, useMyContracts, useMyInvoices, useMyReservations, useMyTickets,
} from './queries.js';
import './MyStoragePage.css';

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

/** U09: the signed-in customer's units, what is due and recent invoices. */
export default function MyStoragePage() {
    const { session } = useAuth();
    const today = todayIso();
    const contracts = useMyContracts();
    const reservations = useMyReservations();
    const invoices = useMyInvoices();
    const tickets = useMyTickets();

    const live = (contracts.data?.items ?? []).filter((c) => LIVE_CONTRACT.includes(c.status));
    const allReservations = reservations.data?.items ?? [];
    const waiting = allReservations.filter((r) => AWAITING_CHECK_IN.includes(r.status) && !r.contractId);
    const reservationOf = Object.fromEntries(allReservations.map((r) => [r.reservationId, r]));
    const unitOf = Object.fromEntries((contracts.data?.items ?? []).map((c) => [c.contractId, c.unitCode]));
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
                <div><h1>Xin chào, {firstName}</h1><p>Mọi thông tin về các kho bạn đang thuê.</p></div>
                <Link to="/booking" className={`se-btn ${next ? 'se-btn-outline' : 'se-btn-primary'}`}><Icon name="box" size={16} /> Thuê thêm kho</Link>
            </div>

            {failed && <div className="se-alert" role="alert">Một số thông tin chưa tải được. Vui lòng tải lại trang.</div>}

            {next && (
                <div className={`se-due${next.status === 'Overdue' ? ' overdue' : ''}`}>
                    <Icon name="clock" size={20} />
                    <div>
                        <strong>{next.status === 'Overdue' ? 'Quá hạn: ' : 'Sắp đến hạn: '}hóa đơn {next.invoiceNumber} · {formatDate(next.dueDate)}</strong>
                        <small>{next.status === 'Overdue' ? `Thanh toán ${formatVnd(next.outstandingAmount)} sớm để tránh bị tính thêm phí trễ hạn.` : `Thanh toán ${formatVnd(next.outstandingAmount)} trước hạn để không bị tính phí trễ hạn.`}</small>
                    </div>
                    <Link to="/payments" className="se-btn se-btn-primary se-btn-sm">Thanh toán ngay</Link>
                </div>
            )}

            <div className="se-stats">
                <Stat icon="box" label="Kho đang thuê" value={live.filter((c) => c.status !== 'Draft').length} note={`${waiting.length + live.filter((c) => c.status === 'Draft').length} kho chờ nhận`} />
                <Stat icon="card" label="Khoản cần thanh toán" value={next ? formatVnd(next.outstandingAmount) : '—'} note={next ? `Hạn ${formatDate(next.dueDate)}` : 'Không có khoản nào đến hạn'} />
                <Stat icon="chat" label="Yêu cầu đang mở" value={openTickets.length} note={openTickets[0]?.subject ?? 'Không có yêu cầu nào'} />
                <Stat icon="shield" label="Tiền cọc đang giữ" value={formatVnd(deposit)} note="Được hoàn lại khi trả kho" />
            </div>

            <h2>Kho của tôi</h2>
            <div className="se-units">
                {live.map((c) => {
                    const [tone, label] = CONTRACT_BADGE[c.status];
                    const r = reservationOf[c.reservationId];
                    const code = codeOf[c.contractId];
                    const used = periodUsed(c.startDate, c.endDate, today);
                    return (
                        <article key={c.contractId} className="se-card se-unit">
                            <header>
                                <span className="se-unit-icon"><Icon name="box" size={20} /></span>
                                <div><strong>Kho {c.unitCode}</strong><small>{r?.unitTypeName ?? ''}</small></div>
                                <span className={`se-badge ${tone}`}>{label}</span>
                            </header>
                            <dl>
                                <div><dt>Cơ sở</dt><dd>{r?.facilityName ?? '—'}</dd></div>
                                <div><dt>Mã ra vào</dt><dd>{code?.isActive ? `Đang dùng · hết hạn ${formatDate(code.expiresAt)}` : c.status === 'Draft' ? 'Cấp khi nhận kho' : 'Chưa có mã đang dùng'}</dd></div>
                                <div><dt>Thời hạn thuê</dt><dd>{formatDate(c.startDate)} → {formatDate(c.endDate)}</dd></div>
                            </dl>
                            <p className="se-unit-progress-label">{c.status === 'Draft' ? 'Bắt đầu tính sau khi nhận kho' : `Đã dùng ${used}% thời hạn thuê`}</p>
                            <div className="se-progress"><span style={{ width: `${c.status === 'Draft' ? 1 : used}%` }} /></div>
                            <div className="se-unit-actions">
                                <Link to={`/my-storage/units/${c.contractId}`} className="se-btn se-btn-outline se-btn-sm">Xem chi tiết</Link>
                                <Link to={`/support/new?contractId=${c.contractId}`} className="se-btn se-btn-ghost se-btn-sm">Báo sự cố</Link>
                            </div>
                        </article>
                    );
                })}
                {waiting.map((r) => (
                    <article key={`r${r.reservationId}`} className="se-card se-unit">
                        <header>
                            <span className="se-unit-icon"><Icon name="box" size={20} /></span>
                            <div><strong>{r.unitCode ? `Kho ${r.unitCode}` : 'Kho đang chờ xếp'}</strong><small>{r.unitTypeName}</small></div>
                            <span className="se-badge low">Chờ nhận kho</span>
                        </header>
                        <dl>
                            <div><dt>Cơ sở</dt><dd>{r.facilityName}</dd></div>
                            <div><dt>Mã ra vào</dt><dd>Được cấp khi nhận kho ngày {formatDate(r.moveInDate)}</dd></div>
                            <div><dt>Thời hạn thuê</dt><dd>{formatDate(r.moveInDate)} → {formatDate(rentalEndDate(r.moveInDate, r.rentalMonths))}</dd></div>
                        </dl>
                        <p className="se-unit-progress-label">Bắt đầu tính sau khi nhận kho</p>
                        <div className="se-progress"><span style={{ width: '1%' }} /></div>
                        <div className="se-unit-actions">
                            <Link to={`/booking/confirmed/${r.reservationId}`} className="se-btn se-btn-outline se-btn-sm">Xem đơn đặt kho</Link>
                        </div>
                    </article>
                ))}
                {!live.length && !waiting.length && !contracts.isLoading && !reservations.isLoading && (
                    <div className="se-card se-empty">Bạn chưa thuê kho nào. <Link to="/booking" className="se-link">Đặt kho đầu tiên</Link></div>
                )}
            </div>

            <h2>Hóa đơn gần đây</h2>
            <div className="se-card se-table-wrap">
                <table className="se-table se-stack">
                    <thead><tr><th>Ngày lập</th><th>Hóa đơn</th><th>Kho</th><th>Nội dung</th><th>Số tiền</th><th>Trạng thái</th></tr></thead>
                    <tbody>
                        {allInvoices.slice(0, 5).map((inv) => {
                            const [tone, label] = invoiceBadge(inv);
                            return (
                                <tr key={inv.invoiceId}>
                                    <td data-label="Ngày lập">{formatDate(inv.issueDate)}</td>
                                    <td data-label="Hóa đơn">{inv.invoiceNumber}</td>
                                    <td data-label="Kho">{unitOf[inv.contractId] ?? '—'}</td>
                                    <td data-label="Nội dung">{inv.items?.[0]?.description ?? '—'}</td>
                                    <td data-label="Số tiền" className="price">{formatVnd(inv.totalAmount)}</td>
                                    <td data-label="Trạng thái"><span className={`se-badge ${tone}`}>{label}</span></td>
                                </tr>
                            );
                        })}
                        {!allInvoices.length && <tr><td colSpan={6} className="se-empty">{invoices.isLoading ? 'Đang tải hóa đơn…' : 'Bạn chưa có hóa đơn nào.'}</td></tr>}
                    </tbody>
                </table>
            </div>
        </>
    );
}
