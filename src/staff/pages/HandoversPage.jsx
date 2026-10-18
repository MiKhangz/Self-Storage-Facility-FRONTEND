import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handoversApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { useAuth } from '../../features/auth/AuthContext';
import { Roles } from '../../features/auth/roles';
import Icon from '../../customer/components/Icon.jsx';
import { formatDate, formatVnd } from '../../customer/components/format.js';
import { formatDateTime } from '../../customer/support/support.js';
import { PageHeader, Stat, Status, TableState } from '../components/ui.jsx';
import { humanize, useHandovers } from '../queries.js';

const TABS = ['Requested', 'Approved', 'Inspected', 'Completed', 'Cancelled'];
const CONDITIONS = ['Good', 'MinorDamage', 'MajorDamage'];

function Approve({ request, onDone }) {
    const [slot, setSlot] = useState(`${request.plannedHandoverDate}T09:00`);
    const approve = useMutation({ mutationFn: () => handoversApi.approve(request.handoverId, { inspectionSlot: slot }), onSuccess: onDone });
    return (
        <>
            <label><span className="se-label">Inspection appointment</span>
                <div className="se-input"><input type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)} /></div></label>
            {approve.isError && <div className="se-alert" role="alert">{errorMessage(approve.error)}</div>}
            <button type="button" className="se-btn se-btn-primary se-btn-block" disabled={!slot || approve.isPending} onClick={() => approve.mutate()}>Approve &amp; book inspection</button>
        </>
    );
}

function Inspect({ request, onDone }) {
    const [form, setForm] = useState({ conditionResult: 'Good', cleaningFee: 0, repairCharge: 0, otherDeduction: 0 });
    const set = (k) => (e) => setForm({ ...form, [k]: k === 'conditionResult' ? e.target.value : Math.max(0, Number(e.target.value)) });
    const inspect = useMutation({ mutationFn: () => handoversApi.inspection(request.handoverId, form), onSuccess: onDone });
    return (
        <>
            <span className="se-label">Unit condition</span>
            <div className="se-chips" role="radiogroup" aria-label="Unit condition">
                {CONDITIONS.map((c) => (
                    <button key={c} type="button" role="radio" aria-checked={form.conditionResult === c} className={`se-chip${form.conditionResult === c ? ' active' : ''}`}
                        onClick={() => setForm({ ...form, conditionResult: c })}>{humanize(c)}</button>
                ))}
            </div>
            {[['cleaningFee', 'Cleaning fee'], ['repairCharge', 'Repair charge'], ['otherDeduction', 'Other deduction']].map(([k, label]) => (
                <label key={k}><span className="se-label">{label} (₫)</span><div className="se-input"><input type="number" min="0" step="1000" value={form[k]} onChange={set(k)} /></div></label>
            ))}
            {inspect.isError && <div className="se-alert" role="alert">{errorMessage(inspect.error)}</div>}
            <button type="button" className="se-btn se-btn-primary se-btn-block" disabled={inspect.isPending} onClick={() => inspect.mutate()}>Save inspection</button>
        </>
    );
}

function Settle({ request, onDone }) {
    // Refresh only when they close the result: refetching makes the request Completed, which would unmount this
    // breakdown (refund and any shortfall the customer still owes) before anyone reads it.
    const settle = useMutation({ mutationFn: () => handoversApi.settleDeposit(request.handoverId) });
    const s = settle.data;
    return (
        <>
            {s && (
                <dl className="se-kv">
                    <div><dt>Deposit</dt><dd>{formatVnd(s.depositAmount)}</dd></div>
                    <div><dt>Damage deductions</dt><dd>− {formatVnd(s.damageDeductions)}</dd></div>
                    {s.earlyTerminationPenalty > 0 && <div><dt>Early return penalty</dt><dd>− {formatVnd(s.earlyTerminationPenalty)}</dd></div>}
                    <div><dt>Outstanding invoices</dt><dd>− {formatVnd(s.outstandingInvoices)}</dd></div>
                    <div><dt><strong>Refund</strong></dt><dd>{formatVnd(s.refundAmount)}</dd></div>
                    {s.shortfall > 0 && <div><dt>Customer still owes</dt><dd className="sa-bad">{formatVnd(s.shortfall)}</dd></div>}
                </dl>
            )}
            {s && <button type="button" className="se-btn se-btn-primary se-btn-block" onClick={onDone}>Done</button>}
            {settle.isError && <div className="se-alert" role="alert">{errorMessage(settle.error)}</div>}
            {!s && <button type="button" className="se-btn se-btn-primary se-btn-block" disabled={settle.isPending}
                onClick={() => window.confirm('Settle the deposit? This closes the contract and frees the unit.') && settle.mutate()}>Settle deposit &amp; close</button>}
        </>
    );
}

/** A15: approve handovers, inspect returned units and settle deposits. */
export default function HandoversPage() {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState('Requested');
    const [selected, setSelected] = useState(null);
    const handovers = useHandovers();
    const all = handovers.data ?? [];
    const shown = all.filter((m) => m.status === tab);
    const current = all.find((m) => m.handoverId === selected);
    const done = () => ['handovers', 'contracts', 'storage-units'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    const isStaff = [Roles.FacilityStaff, Roles.FacilityManager].includes(session?.role);

    return (
        <>
            <PageHeader title="Handovers" subtitle="Inspect returned units, settle deposits and release units" />
            <div className="sa-stats">
                <Stat icon="arrowLeft" label="Handover requests" value={all.filter((m) => m.status === 'Requested').length} />
                <Stat icon="calendar" label="Inspections booked" value={all.filter((m) => m.status === 'Approved').length} />
                <Stat icon="card" tone="warn" label="Awaiting refund" value={all.filter((m) => m.status === 'Inspected').length} />
                <Stat icon="check" label="Completed" value={all.filter((m) => m.status === 'Completed').length} />
            </div>
            <div className="se-tabs se-tabs-line" role="tablist">
                {TABS.map((t) => (
                    <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => { setTab(t); setSelected(null); }}>
                        {humanize(t)} <span className="se-count">{all.filter((m) => m.status === t).length}</span>
                    </button>
                ))}
            </div>
            <div className={`sa-split${current ? ' open' : ''}`}>
                <div className="se-card se-table-wrap">
                    <table className="se-table sa-table">
                        <thead><tr><th>Customer</th><th>Unit</th><th>Contract</th><th>Handover date</th><th>Inspection</th><th>Status</th></tr></thead>
                        <tbody>
                            {shown.map((m) => (
                                <tr key={m.handoverId} className={selected === m.handoverId ? 'active' : ''} onClick={() => setSelected(m.handoverId)}>
                                    <td className="strong">{m.customerName}</td>
                                    <td>{m.unitCode}</td>
                                    <td>{m.contractNumber}</td>
                                    <td>{formatDate(m.plannedHandoverDate)}</td>
                                    <td>{m.inspectionSlot ? formatDateTime(m.inspectionSlot) : '—'}</td>
                                    <td><Status value={m.status} /></td>
                                </tr>
                            ))}
                            <TableState query={handovers} rows={shown} cols={6} empty="Nothing in this list." />
                        </tbody>
                    </table>
                </div>
                {current && (
                    <aside className="se-panel sa-side-panel">
                        <div className="sa-card-title"><h2>Unit {current.unitCode} <Status value={current.status} /></h2>
                            <button type="button" className="sa-close" onClick={() => setSelected(null)} aria-label="Close"><Icon name="arrowLeft" size={16} /></button></div>
                        <p className="sa-muted">{current.customerName} · {current.contractNumber}</p>
                        <dl className="se-kv">
                            <div><dt>Requested</dt><dd>{formatDateTime(current.requestedAt)}</dd></div>
                            <div><dt>Planned handover</dt><dd>{formatDate(current.plannedHandoverDate)}</dd></div>
                            <div><dt>Reason</dt><dd>{current.reason || '—'}</dd></div>
                            <div><dt>Refund to</dt><dd>{humanize(current.refundMethod)}{current.refundAccount ? ` · ${current.refundAccount}` : ''}</dd></div>
                            {current.inspection && <div><dt>Inspection</dt><dd>{humanize(current.inspection.conditionResult)} · refund {formatVnd(current.inspection.refundAmount)}</dd></div>}
                        </dl>
                        {current.status === 'Requested' && isStaff && <Approve request={current} onDone={done} />}
                        {current.status === 'Approved' && isStaff && <Inspect request={current} onDone={done} />}
                        {current.status === 'Inspected' && session?.role === Roles.BusinessOperationsManager && <Settle request={current} onDone={done} />}
                        {current.status === 'Inspected' && session?.role !== Roles.BusinessOperationsManager && <p className="sa-muted">A Business Operations Manager settles the deposit.</p>}
                    </aside>
                )}
            </div>
        </>
    );
}
