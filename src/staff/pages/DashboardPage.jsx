import { Link } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import Icon from '../../customer/components/Icon.jsx';
import { addDays, formatVnd, todayIso } from '../../customer/components/format.js';
import { formatDateTime } from '../../customer/support/support.js';
import { PageHeader, Stat, Status, TableState } from '../components/ui.jsx';
import { humanize, useContracts, useFacilities, useInvoices, useReservations, useTasks, useTickets, useUnits } from '../queries.js';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const compactVnd = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}B ₫` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M ₫` : formatVnd(n));

/** Occupied share of the units that can be rented (retired units excluded). */
export function occupancy(units) {
    const rentable = units.filter((u) => u.status !== 'Retired');
    return rentable.length ? Math.round((rentable.filter((u) => u.status === 'Occupied').length / rentable.length) * 1000) / 10 : 0;
}

/** A02: what needs doing today, and how the business is doing. */
export default function DashboardPage() {
    const { session } = useAuth();
    const today = todayIso();
    const year = today.slice(0, 4);
    const month = today.slice(0, 7);
    const facilities = useFacilities();
    const units = useUnits();
    const contracts = useContracts();
    const invoices = useInvoices();
    const reservations = useReservations({ status: 'Pending' });
    const tickets = useTickets();
    const tasks = useTasks();

    const allUnits = units.data ?? [];
    const allContracts = contracts.data ?? [];
    const allInvoices = invoices.data ?? [];
    const active = allContracts.filter((c) => c.status === 'Active');
    const overdue = allInvoices.filter((i) => i.status === 'Overdue');
    const paidInMonth = (m) => allInvoices.filter((i) => i.issueDate?.startsWith(m)).reduce((s, i) => s + (i.paidAmount ?? 0), 0);
    const revenue = MONTHS.map((_, i) => paidInMonth(`${year}-${String(i + 1).padStart(2, '0')}`));
    const maxRevenue = Math.max(...revenue, 1);
    const urgent = (tickets.data ?? []).filter((t) => t.priority === 'Urgent' && !['Resolved', 'Closed'].includes(t.status));
    const expiring = active.filter((c) => c.endDate >= today && c.endDate <= addDays(today, 14));
    const todaysTasks = (tasks.data ?? []).filter((t) => t.scheduledAt?.startsWith(today)).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    const firstName = session?.fullName?.trim().split(/\s+/).at(-1);

    const attention = [
        { icon: 'clock', tone: 'bad', count: overdue.length, text: 'invoices overdue', to: '/admin/payments' },
        { icon: 'calendar', tone: 'warn', count: reservations.data?.length ?? 0, text: 'reservations to assign', to: '/admin/reservations' },
        { icon: 'chat', tone: '', count: urgent.length, text: 'urgent support tickets', to: '/admin/tickets' },
        { icon: 'file', tone: '', count: expiring.length, text: 'contracts expire in 14 days', to: '/admin/contracts' },
    ];

    return (
        <>
            <PageHeader title={`Hello, ${firstName}`} subtitle={`${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })} · All facilities`}>
                <Link to="/admin/reports" className="se-btn se-btn-primary"><Icon name="file" size={16} /> Reports</Link>
            </PageHeader>

            <div className="sa-stats">
                <Stat icon="grid" label="Occupancy rate" value={`${occupancy(allUnits)}%`} note={`${allUnits.length} units`} />
                <Stat icon="card" label={`Revenue (${new Date().toLocaleString('en', { month: 'short' })})`} value={compactVnd(paidInMonth(month))} note="paid on invoices issued this month" />
                <Stat icon="file" label="Active contracts" value={active.length} note={`${allContracts.filter((c) => c.status === 'Draft').length} drafts awaiting handover`} />
                <Stat icon="clock" tone="bad" label="Overdue payments" value={overdue.length} note={formatVnd(overdue.reduce((s, i) => s + (i.outstandingAmount ?? 0), 0))} />
            </div>

            <div className="sa-grid-2">
                <section className="se-panel">
                    <div className="sa-card-title"><h2>Monthly revenue {year}</h2><span className="sa-muted">Paid amount by invoice month</span></div>
                    <div className="sa-bars" role="img" aria-label={`Revenue per month in ${year}`}>
                        {revenue.map((v, i) => (
                            <div key={i} className="sa-bar" title={`${MONTHS[i]}: ${formatVnd(v)}`}>
                                <span style={{ height: `${(v / maxRevenue) * 100}%` }} className={i === Number(month.slice(5)) - 1 ? 'current' : ''} />
                                <small>{MONTHS[i]}</small>
                            </div>
                        ))}
                    </div>
                </section>
                <section className="se-panel">
                    <div className="sa-card-title"><h2>Occupancy by facility</h2></div>
                    <div className="sa-occupancy">
                        {(facilities.data ?? []).map((f) => {
                            const pct = occupancy(allUnits.filter((u) => u.facilityId === f.facilityId));
                            return (
                                <div key={f.facilityId}>
                                    <div className="sa-occ-label"><span>{f.name}</span><strong className={pct >= 90 ? 'hot' : ''}>{pct}%</strong></div>
                                    <div className="se-progress flat"><span style={{ width: `${pct}%` }} className={pct >= 90 ? 'hot' : ''} /></div>
                                </div>
                            );
                        })}
                        {!facilities.data?.length && <p className="sa-muted">{facilities.isLoading ? 'Loading…' : 'No facilities.'}</p>}
                    </div>
                </section>
            </div>

            <div className="sa-grid-2">
                <section className="se-panel">
                    <div className="sa-card-title"><h2>Today&apos;s schedule</h2><Link to="/admin/handover" className="se-link">Open handover desk <Icon name="arrow" size={14} /></Link></div>
                    <div className="se-table-wrap">
                        <table className="se-table">
                            <thead><tr><th>Time</th><th>Type</th><th>Reference</th><th>Staff</th><th>Status</th></tr></thead>
                            <tbody>
                                {todaysTasks.map((t) => (
                                    <tr key={t.taskId}>
                                        <td>{formatDateTime(t.scheduledAt).slice(0, 5)}</td>
                                        <td>{humanize(t.taskType)}</td>
                                        <td>{t.referenceCode ?? '—'}</td>
                                        <td>{t.assignedToName}</td>
                                        <td><Status value={t.status} /></td>
                                    </tr>
                                ))}
                                <TableState query={tasks} rows={todaysTasks} cols={5} empty="Nothing scheduled today." />
                            </tbody>
                        </table>
                    </div>
                </section>
                <section className="se-panel">
                    <div className="sa-card-title"><h2>Needs attention</h2></div>
                    <div className="sa-attention">
                        {attention.map((a) => (
                            <Link key={a.text} to={a.to} className="sa-attention-item">
                                <span className={`sa-stat-icon ${a.tone}`}><Icon name={a.icon} size={16} /></span>
                                <span><strong>{a.count}</strong> {a.text}</span>
                                <Icon name="arrow" size={14} />
                            </Link>
                        ))}
                    </div>
                </section>
            </div>
        </>
    );
}

