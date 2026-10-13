import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { contractsApi } from '../../api/generated';
import { useAuth } from '../../features/auth/AuthContext';
import Icon from '../components/Icon.jsx';
import { formatDate, formatVnd, rentalEndDate, todayIso } from '../components/format.js';
import {
    AWAITING_CHECK_IN, LIVE_CONTRACT, OPEN_INVOICE, OPEN_TICKET, invoiceBadge,
    periodUsed, useMyContracts, useMyInvoices, useMyReservations, useMyTickets,
} from './queries.js';
import './MyStoragePage.css';

const CONTRACT_BADGE = {
    Draft: ['low', 'Awaiting handover'], Active: ['', 'Active'], PendingMoveOut: ['low', 'Moving out'],
    Overdue: ['none', 'Overdue'], Suspended: ['none', 'Access suspended'],
};

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
                <div><h1>Hello, {firstName}</h1><p>Here is everything about your storage units.</p></div>
                <Link to="/booking" className="se-btn se-btn-primary"><Icon name="box" size={16} /> Rent another unit</Link>
            </div>

            {failed && <div className="se-alert" role="alert">Some of your data could not be loaded. Please refresh the page.</div>}

            {next && (
                <div className={`se-due${next.status === 'Overdue' ? ' overdue' : ''}`}>
                    <Icon name="clock" size={20} />
                    <div>
                        <strong>{next.status === 'Overdue' ? 'Overdue: ' : 'Payment due: '}{next.invoiceNumber} · {formatDate(next.dueDate)}</strong>
                        <small>Pay {formatVnd(next.outstandingAmount)} before the due date to avoid a late fee.</small>
                    </div>
                    <Link to="/payments" className="se-btn se-btn-amber se-btn-sm">Pay now</Link>
                </div>
            )}

            <div className="se-stats">
                <Stat icon="box" label="Active units" value={live.filter((c) => c.status !== 'Draft').length} note={`${waiting.length + live.filter((c) => c.status === 'Draft').length} awaiting check-in`} />
                <Stat icon="card" label="Next payment" value={next ? formatVnd(next.outstandingAmount) : '—'} note={next ? `Due ${formatDate(next.dueDate)}` : 'Nothing due'} />
                <Stat icon="chat" label="Open requests" value={openTickets.length} note={openTickets[0]?.subject ?? 'No open requests'} />
                <Stat icon="shield" label="Deposit held" value={formatVnd(deposit)} note="Refundable" />
            </div>

            <h2>My units</h2>
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
                                <div><strong>Unit {c.unitCode}</strong><small>{r?.unitTypeName ?? ''}</small></div>
                                <span className={`se-badge ${tone}`}>{label}</span>
                            </header>
                            <dl>
                                <div><dt>Facility</dt><dd>{r?.facilityName ?? '—'}</dd></div>
                                <div><dt>Access code</dt><dd>{code?.isActive ? `Active · expires ${formatDate(code.expiresAt)}` : c.status === 'Draft' ? 'Issued at check-in' : 'No active code'}</dd></div>
                                <div><dt>Rental period</dt><dd>{formatDate(c.startDate)} → {formatDate(c.endDate)}</dd></div>
                            </dl>
                            <p className="se-unit-progress-label">{c.status === 'Draft' ? 'Starts after check-in' : `${used}% of rental period used`}</p>
                            <div className="se-progress"><span style={{ width: `${c.status === 'Draft' ? 1 : used}%` }} /></div>
                            <div className="se-unit-actions">
                                <Link to={`/my-storage/units/${c.contractId}`} className="se-btn se-btn-primary se-btn-sm">View details</Link>
                                <Link to={`/support/new?contractId=${c.contractId}`} className="se-btn se-btn-ghost se-btn-sm">Report issue</Link>
                            </div>
                        </article>
                    );
                })}
                {waiting.map((r) => (
                    <article key={`r${r.reservationId}`} className="se-card se-unit">
                        <header>
                            <span className="se-unit-icon"><Icon name="box" size={20} /></span>
                            <div><strong>{r.unitCode ? `Unit ${r.unitCode}` : 'Unit to be assigned'}</strong><small>{r.unitTypeName}</small></div>
                            <span className="se-badge low">Awaiting check-in</span>
                        </header>
                        <dl>
                            <div><dt>Facility</dt><dd>{r.facilityName}</dd></div>
                            <div><dt>Access code</dt><dd>Check-in {formatDate(r.moveInDate)} to claim access</dd></div>
                            <div><dt>Rental period</dt><dd>{formatDate(r.moveInDate)} → {formatDate(rentalEndDate(r.moveInDate, r.rentalMonths))}</dd></div>
                        </dl>
                        <p className="se-unit-progress-label">Starts after check-in</p>
                        <div className="se-progress"><span style={{ width: '1%' }} /></div>
                        <div className="se-unit-actions">
                            <Link to={`/booking/confirmed/${r.reservationId}`} className="se-btn se-btn-primary se-btn-sm">View booking</Link>
                        </div>
                    </article>
                ))}
                {!live.length && !waiting.length && !contracts.isLoading && !reservations.isLoading && (
                    <div className="se-card se-empty">You have no storage units yet. <Link to="/booking" className="se-link">Book your first unit</Link></div>
                )}
            </div>

            <h2>Recent invoices</h2>
            <div className="se-card se-table-wrap">
                <table className="se-table">
                    <thead><tr><th>Date</th><th>Invoice</th><th>Unit</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
                    <tbody>
                        {allInvoices.slice(0, 5).map((inv) => {
                            const [tone, label] = invoiceBadge(inv);
                            return (
                                <tr key={inv.invoiceId}>
                                    <td>{formatDate(inv.issueDate)}</td>
                                    <td>{inv.invoiceNumber}</td>
                                    <td>{unitOf[inv.contractId] ?? '—'}</td>
                                    <td>{inv.items?.[0]?.description ?? '—'}</td>
                                    <td className="price">{formatVnd(inv.totalAmount)}</td>
                                    <td><span className={`se-badge ${tone}`}>{label}</span></td>
                                </tr>
                            );
                        })}
                        {!allInvoices.length && <tr><td colSpan={6} className="se-empty">{invoices.isLoading ? 'Loading…' : 'No invoices yet.'}</td></tr>}
                    </tbody>
                </table>
            </div>
        </>
    );
}
