import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api/axiosClient';
import { contractsApi, pricingPoliciesApi } from '../../api/generated';
import { useAuth } from '../../features/auth/AuthContext';
import { Roles } from '../../features/auth/roles';
import Icon from '../../customer/components/Icon.jsx';
import { addDays, formatDate, formatVnd, todayIso } from '../../customer/components/format.js';
import { initials } from '../../customer/layout/CustomerLayout.jsx';
import { periodUsed } from '../../customer/account/queries.js';
import { PageHeader, SearchFilter, Filters, Status, TableState, downloadFile, matches } from '../components/ui.jsx';
import { useContracts, useInvoices } from '../queries.js';

const ENDED = ['Closed', 'Terminated'];
const TABS = [
    { key: 'all', label: 'All contracts', match: () => true },
    { key: 'active', label: 'Active', match: (c) => c.status === 'Active' },
    { key: 'expiring', label: 'Expiring in 14 days', match: (c, today) => c.status === 'Active' && c.endDate >= today && c.endDate <= addDays(today, 14) },
    { key: 'overdue', label: 'Overdue', match: (c, _t, owing) => c.status === 'Overdue' || c.status === 'Suspended' || owing[c.contractId]?.overdue },
    { key: 'ended', label: 'Ended', match: (c) => ENDED.includes(c.status) },
];
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

function ContractPanel({ contract, invoices, onClose }) {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const today = todayIso();
    const open = invoices.filter((i) => ['Issued', 'Overdue'].includes(i.status)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const due = open.reduce((s, i) => s + (i.outstandingAmount ?? 0), 0);
    const oldest = open.find((i) => i.status === 'Overdue');
    // Overdue stages come from the active pricing policy (grace → late fee → suspend → clear-out).
    const policies = useQuery({
        queryKey: ['pricing-policies'], queryFn: () => pricingPoliciesApi.list({ page: 1, pageSize: 20 }),
        enabled: session?.role === Roles.BusinessOperationsManager && !!oldest,
    });
    const policy = policies.data?.items?.find((p) => p.status === 'Active');
    const terminate = useMutation({
        mutationFn: () => contractsApi.terminate(contract.contractId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts'] }),
    });
    const canTerminate = session?.role === Roles.FacilityManager && !ENDED.includes(contract.status) && contract.status !== 'Draft';

    return (
        <aside className="se-panel sa-side-panel">
            <div className="sa-card-title">
                <h2>{contract.contractNumber} <Status value={contract.status} /></h2>
                <button type="button" className="sa-close" onClick={onClose} aria-label="Close"><Icon name="arrowLeft" size={16} /></button>
            </div>
            <p className="sa-muted"><Link to={`/admin/customers/${contract.customerId}`} className="se-link">{contract.customerName}</Link> · Unit {contract.unitCode}</p>
            {due > 0 && (
                <div className={`sa-eligibility ${oldest ? 'no' : ''}`}>
                    <small>Total due</small><strong>{formatVnd(due)}</strong>
                    {oldest && <small>{daysBetween(oldest.dueDate, today)} days overdue since {formatDate(oldest.dueDate)}</small>}
                </div>
            )}
            <dl className="se-kv">
                <div><dt>Period</dt><dd>{formatDate(contract.startDate)} → {formatDate(contract.endDate)}</dd></div>
                <div><dt>Monthly rent</dt><dd>{formatVnd(contract.monthlyRent)}</dd></div>
                <div><dt>Deposit held</dt><dd>{formatVnd(contract.depositAmount)}</dd></div>
                <div><dt>Payment day</dt><dd>Day {contract.paymentDay}</dd></div>
                <div><dt>Signed</dt><dd>{contract.signedAt ? formatDate(contract.signedAt) : 'Not yet'}</dd></div>
            </dl>
            {oldest && policy && (
                <>
                    <span className="se-label">Overdue timeline (policy v{policy.version})</span>
                    <ul className="sa-timeline">
                        {[
                            [0, 'Due date passed'],
                            [policy.graceDays, 'Grace period ends · late fee applies'],
                            [policy.suspendAfterDays, 'Access code suspended'],
                            [policy.clearOutAfterDays, 'Unit clear-out & deposit deduction'],
                        ].map(([days, text]) => {
                            const date = addDays(oldest.dueDate, days);
                            return <li key={text} className={date <= today ? 'past' : ''}><b>{formatDate(date)}</b> {text}</li>;
                        })}
                    </ul>
                </>
            )}
            {terminate.isError && <div className="se-alert" role="alert">{errorMessage(terminate.error)}</div>}
            {!!open.length && <Link to={`/admin/payments?invoiceId=${open[0].invoiceId}`} className="se-btn se-btn-primary se-btn-block"><Icon name="card" size={16} /> Record payment</Link>}
            {canTerminate && (
                <button type="button" className="se-btn se-btn-danger se-btn-block" disabled={terminate.isPending}
                    onClick={() => window.confirm(`Terminate contract ${contract.contractNumber}? This revokes access and cannot be undone.`) && terminate.mutate()}>
                    Terminate contract
                </button>
            )}
        </aside>
    );
}

/** A07: every rental contract — who, which unit, what is owed — with overdue follow-up. */
export default function ContractsPage() {
    const today = todayIso();
    const [tab, setTab] = useState('all');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(null);
    const [exportError, setExportError] = useState('');
    const contracts = useContracts();
    const invoices = useInvoices();
    const all = contracts.data ?? [];
    const allInvoices = invoices.data ?? [];
    const owing = {};
    for (const i of allInvoices.filter((x) => ['Issued', 'Overdue'].includes(x.status))) {
        const o = (owing[i.contractId] ??= { amount: 0, overdue: false });
        o.amount += i.outstandingAmount ?? 0;
        o.overdue ||= i.status === 'Overdue';
    }
    const tabMatch = TABS.find((t) => t.key === tab).match;
    const shown = all.filter((c) => tabMatch(c, today, owing) && matches(search, c.contractNumber, c.customerName, c.unitCode));
    const current = all.find((c) => c.contractId === selected);

    const exportCsv = () => downloadFile(api, '/api/contracts/export', {}, `contracts-${today}.csv`).catch((e) => setExportError(errorMessage(e)));

    return (
        <>
            <PageHeader title="Customers & contracts" subtitle="Monitor rental periods, payment status, renewals and overdue cases">
                <button type="button" className="se-btn se-btn-primary" onClick={exportCsv}><Icon name="file" size={16} /> Export CSV</button>
            </PageHeader>
            {exportError && <div className="se-alert" role="alert">{exportError}</div>}
            <div className="se-tabs se-tabs-line" role="tablist">
                {TABS.map((t) => (
                    <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
                        {t.label} <span className="se-count">{all.filter((c) => t.match(c, today, owing)).length}</span>
                    </button>
                ))}
            </div>
            <Filters><SearchFilter value={search} onChange={setSearch} placeholder="Search contract, customer or unit" /></Filters>
            <div className={`sa-split${current ? ' open' : ''}`}>
                <div className="se-card se-table-wrap">
                    <table className="se-table sa-table">
                        <thead><tr><th>Contract</th><th>Customer</th><th>Unit</th><th>Period</th><th>Balance due</th><th>Status</th></tr></thead>
                        <tbody>
                            {shown.map((c) => (
                                <tr key={c.contractId} className={selected === c.contractId ? 'active' : ''} onClick={() => setSelected(c.contractId)}>
                                    <td className="strong">{c.contractNumber}</td>
                                    <td><span className="sa-person"><span className="se-avatar">{initials(c.customerName)}</span>{c.customerName}</span></td>
                                    <td>{c.unitCode}</td>
                                    <td><div className="sa-inline-bar"><div className="se-progress flat"><span style={{ width: `${periodUsed(c.startDate, c.endDate, today)}%` }} /></div></div></td>
                                    <td className={owing[c.contractId]?.overdue ? 'sa-bad price' : 'price'}>{owing[c.contractId] ? formatVnd(owing[c.contractId].amount) : '—'}</td>
                                    <td><Status value={c.status} /></td>
                                </tr>
                            ))}
                            <TableState query={contracts} rows={shown} cols={6} empty="No contracts in this list." />
                        </tbody>
                    </table>
                </div>
                {current && <ContractPanel key={current.contractId} contract={current} invoices={allInvoices.filter((i) => i.contractId === current.contractId)} onClose={() => setSelected(null)} />}
            </div>
        </>
    );
}
