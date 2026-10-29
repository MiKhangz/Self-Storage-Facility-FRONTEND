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
import { useT } from '../../i18n/I18n.jsx';

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
    const t = useT();
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

            <h2>{t('Kho của tôi')}</h2>
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
                                <div><strong>{t('Kho')} {c.unitCode}</strong><small>{r?.unitTypeName ?? ''}</small></div>
                                <span className={`se-badge ${tone}`}>{t(label)}</span>
                            </header>
                            <dl>
                                <div><dt>{t('Cơ sở')}</dt><dd>{r?.facilityName ?? '—'}</dd></div>
                                <div><dt>{t('Mã ra vào')}</dt><dd>{code?.isActive ? t('Đang dùng · hết hạn {date}', { date: formatDate(code.expiresAt) }) : t(c.status === 'Draft' ? 'Cấp khi nhận kho' : 'Chưa có mã đang dùng')}</dd></div>
                                <div><dt>{t('Thời hạn thuê')}</dt><dd>{formatDate(c.startDate)} → {formatDate(c.endDate)}</dd></div>
                            </dl>
                            <p className="se-unit-progress-label">{c.status === 'Draft' ? t('Bắt đầu tính sau khi nhận kho') : t('Đã dùng {used}% thời hạn thuê', { used })}</p>
                            <div className="se-progress"><span style={{ width: `${c.status === 'Draft' ? 1 : used}%` }} /></div>
                            <div className="se-unit-actions">
                                <Link to={`/my-storage/units/${c.contractId}`} className="se-btn se-btn-outline se-btn-sm">{t('Xem chi tiết')}</Link>
                                <Link to={`/support/new?contractId=${c.contractId}`} className="se-btn se-btn-ghost se-btn-sm">{t('Báo sự cố')}</Link>
                            </div>
                        </article>
                    );
                })}
                {waiting.map((r) => (
                    <article key={`r${r.reservationId}`} className="se-card se-unit">
                        <header>
                            <span className="se-unit-icon"><Icon name="box" size={20} /></span>
                            <div><strong>{r.unitCode ? `${t('Kho')} ${r.unitCode}` : t('Kho đang chờ xếp')}</strong><small>{r.unitTypeName}</small></div>
                            <span className="se-badge low">{t('Chờ nhận kho')}</span>
                        </header>
                        <dl>
                            <div><dt>{t('Cơ sở')}</dt><dd>{r.facilityName}</dd></div>
                            <div><dt>{t('Mã ra vào')}</dt><dd>{t('Được cấp khi nhận kho ngày {date}', { date: formatDate(r.moveInDate) })}</dd></div>
                            <div><dt>{t('Thời hạn thuê')}</dt><dd>{formatDate(r.moveInDate)} → {formatDate(rentalEndDate(r.moveInDate, r.rentalMonths))}</dd></div>
                        </dl>
                        <p className="se-unit-progress-label">{t('Bắt đầu tính sau khi nhận kho')}</p>
                        <div className="se-progress"><span style={{ width: '1%' }} /></div>
                        <div className="se-unit-actions">
                            <Link to={`/booking/confirmed/${r.reservationId}`} className="se-btn se-btn-outline se-btn-sm">{t('Xem đơn đặt kho')}</Link>
                        </div>
                    </article>
                ))}
                {!live.length && !waiting.length && !contracts.isLoading && !reservations.isLoading && (
                    <div className="se-card se-empty">{t('Bạn chưa thuê kho nào.')} <Link to="/booking" className="se-link">{t('Đặt kho đầu tiên')}</Link></div>
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
