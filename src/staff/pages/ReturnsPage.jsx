import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { depositRefundsApi, handoversApi, pricingPoliciesApi, returnsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { useAuth } from '../../features/auth/AuthContext';
import { Roles } from '../../features/auth/roles';
import Icon from '../../customer/components/Icon.jsx';
import { formatDate, formatVnd } from '../../customer/components/format.js';
import { formatDateTime } from '../../customer/support/support.js';
import HandoverPhotos from '../components/HandoverPhotos.jsx';
import { Modal, PageHeader, Stat, Status, TableState } from '../components/ui.jsx';
import { fetchAll, humanize, useContracts, useInvoices, useReturns } from '../queries.js';
import { useT } from '../../i18n/I18n.jsx';
import { confirmAction } from '../../customer/components/confirm.js';

const TABS = ['Requested', 'Approved', 'Inspected', 'Completed', 'Cancelled'];
const CONDITIONS = ['Good', 'MinorDamage', 'MajorDamage'];

/** 09:00 on the planned day, or the next full hour when that has already passed (a same-day return). */
function firstSlot(plannedDate) {
    const nine = new Date(`${plannedDate}T09:00`);
    if (nine > new Date()) return `${plannedDate}T09:00`;
    const next = new Date();
    next.setHours(next.getHours() + 1, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:00`;
}

function Approve({ request, onDone }) {
    const tr = useT();
    const [slot, setSlot] = useState(() => firstSlot(request.plannedReturnDate));
    const approve = useMutation({ mutationFn: () => returnsApi.approve(request.unitReturnId, { inspectionSlot: slot }), onSuccess: onDone });
    return (
        <>
            <label><span className="se-label">{tr('Inspection appointment')}</span>
                <div className="se-input"><input type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)} /></div></label>
            {approve.isError && <div className="se-alert" role="alert">{errorMessage(approve.error)}</div>}
            <button type="button" className="se-btn se-btn-primary se-btn-block" disabled={!slot || approve.isPending} onClick={() => approve.mutate()}>{tr('Approve & book inspection')}</button>
        </>
    );
}

function Inspect({ request, onDone }) {
    const tr = useT();
    const [form, setForm] = useState({ conditionResult: 'Good', cleaningFee: 0, repairCharge: 0, otherDeduction: 0 });
    const set = (k) => (e) => setForm({ ...form, [k]: k === 'conditionResult' ? e.target.value : Math.max(0, Number(e.target.value)) });
    const inspect = useMutation({ mutationFn: () => returnsApi.inspection(request.unitReturnId, form), onSuccess: onDone });
    return (
        <>
            <span className="se-label">{tr('Unit condition')}</span>
            <div className="se-chips" role="radiogroup" aria-label={tr('Unit condition')}>
                {CONDITIONS.map((c) => (
                    <button key={c} type="button" role="radio" aria-checked={form.conditionResult === c} className={`se-chip${form.conditionResult === c ? ' active' : ''}`}
                        onClick={() => setForm({ ...form, conditionResult: c })}>{tr(humanize(c))}</button>
                ))}
            </div>
            {[['cleaningFee', 'Cleaning fee'], ['repairCharge', 'Repair charge'], ['otherDeduction', 'Other deduction']].map(([k, label]) => (
                <label key={k}><span className="se-label">{tr(label)} (₫)</span><div className="se-input"><input type="number" min="0" step="1000" value={form[k]} onChange={set(k)} /></div></label>
            ))}
            {inspect.isError && <div className="se-alert" role="alert">{errorMessage(inspect.error)}</div>}
            <button type="button" className="se-btn se-btn-primary se-btn-block" disabled={inspect.isPending} onClick={() => inspect.mutate()}>{tr('Save inspection')}</button>
        </>
    );
}

function ReturnStatus({ item, refundMap }) {
    const tr = useT();
    if (item.status !== 'Completed') return <Status value={item.status} />;
    const refundAmount = item.inspection?.refundAmount ?? 0;
    const refund = refundMap?.[item.unitReturnId];
    const badge = refundAmount <= 0
        ? ['muted', 'No refund due']
        : refund?.status === 'Paid'
            ? ['', 'Paid']
            : ['low', 'Awaiting payout'];
    return (
        <span className="sa-status-pair">
            <span className="se-badge">{tr('Settled')}</span>
            <span className={`se-badge ${badge[0]}`}>{tr(badge[1])}</span>
        </span>
    );
}

function Settle({ request, contract, invoices, terms, onDone, onSettled }) {
    const tr = useT();
    // Refresh only when they close the result: refetching makes the request Settled, which would unmount this
    // breakdown (refund and any shortfall the customer still owes) before anyone reads it.
    const settle = useMutation({
        mutationFn: () => returnsApi.settleDeposit(request.unitReturnId),
        onSuccess: (data) => onSettled?.(data),
    });
    const s = settle.data;

    const deposit = contract?.depositAmount ?? 0;
    const cleaning = request.inspection?.cleaningFee ?? 0;
    const repair = request.inspection?.repairCharge ?? 0;
    const other = request.inspection?.otherDeduction ?? 0;
    const earlyRate = terms?.earlyTerminationPercent ?? 0;
    const earlyTermination = contract && request.plannedReturnDate < contract.endDate
        ? Math.round((deposit * earlyRate) / 100)
        : 0;
    const outstanding = (invoices ?? [])
        .filter((i) => i.contractId === request.contractId && ['Issued', 'Overdue'].includes(i.status))
        .reduce((sum, i) => sum + (i.outstandingAmount ?? ((i.totalAmount ?? 0) - (i.paidAmount ?? 0))), 0);
    const balance = deposit - (cleaning + repair + other + earlyTermination) - outstanding;
    const refundAmount = Math.max(balance, 0);
    const shortfall = Math.max(-balance, 0);

    const confirmBreakdown = () => {
        const message = [
            `${tr('Deposit')}: ${formatVnd(deposit)}`,
            `${tr('Cleaning')}: − ${formatVnd(cleaning)}`,
            `${tr('Repair')}: − ${formatVnd(repair)}`,
            `${tr('Other')}: − ${formatVnd(other)}`,
            `${tr('Early termination')}: − ${formatVnd(earlyTermination)}`,
            `${tr('Outstanding invoices')}: − ${formatVnd(outstanding)}`,
            shortfall > 0
                ? `${tr('Shortfall')}: ${formatVnd(shortfall)}`
                : `${tr('Refund amount')}: ${formatVnd(refundAmount)}`,
            '',
            tr('This closes the contract and releases the unit. The refund will then wait for payout.'),
        ].join('\n');
        confirmAction(message).then((ok) => ok && settle.mutate());
    };

    return (
        <>
            {s && (
                <dl className="se-kv">
                    <div><dt>{tr('Deposit')}</dt><dd>{formatVnd(s.depositAmount)}</dd></div>
                    <div><dt>{tr('Damage deductions')}</dt><dd>− {formatVnd(s.damageDeductions)}</dd></div>
                    {s.earlyTerminationPenalty > 0 && <div><dt>{tr('Early return penalty')}</dt><dd>− {formatVnd(s.earlyTerminationPenalty)}</dd></div>}
                    <div><dt>{tr('Outstanding invoices')}</dt><dd>− {formatVnd(s.outstandingInvoices)}</dd></div>
                    <div><dt><strong>{tr('Refund')}</strong></dt><dd>{formatVnd(s.refundAmount)}</dd></div>
                    {s.shortfall > 0 && <div><dt>{tr('Customer still owes')}</dt><dd className="sa-bad">{formatVnd(s.shortfall)}</dd></div>}
                </dl>
            )}
            {s?.refundAmount > 0 && (
                <div className="se-alert info" role="status">
                    {tr('Refund of {amount} is awaiting payout', { amount: formatVnd(s.refundAmount) })} ·{' '}
                    <Link to="/admin/deposit-refunds" className="se-link">{tr('Go to payout')}</Link>
                </div>
            )}
            {s && <button type="button" className="se-btn se-btn-primary se-btn-block" onClick={onDone}>{tr('Done')}</button>}
            {settle.isError && <div className="se-alert" role="alert">{errorMessage(settle.error)}</div>}
            {!s && <button type="button" className="se-btn se-btn-primary se-btn-block" disabled={settle.isPending}
                onClick={confirmBreakdown}>{tr('Finalize settlement & close contract')}</button>}
        </>
    );
}

/** A15: approve returns, inspect returned units and settle deposits. */
export default function ReturnsPage() {
    const tr = useT();
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState('Requested');
    const [selected, setSelected] = useState(null);
    const [toast, setToast] = useState(null);
    const returns = useReturns();
    const contracts = useContracts();
    const invoices = useInvoices();
    const terms = useQuery({ queryKey: ['pricing-terms'], queryFn: () => pricingPoliciesApi.terms() });
    const canReadRefunds = [Roles.FacilityManager, Roles.BusinessOperationsManager, Roles.SystemAdministrator].includes(session?.role);
    const refunds = useQuery({
        queryKey: ['deposit-refunds', 'all'],
        queryFn: () => fetchAll(depositRefundsApi.list),
        enabled: canReadRefunds,
    });
    const refundMap = Object.fromEntries((refunds.data ?? []).filter((r) => r.unitReturnId != null).map((r) => [r.unitReturnId, r]));
    const all = returns.data ?? [];
    const shown = all.filter((m) => m.status === tab);
    const current = all.find((m) => m.unitReturnId === selected);
    const currentContract = current && (contracts.data ?? []).find((c) => c.contractId === current.contractId);
    // What staff noted when the unit was handed over, to compare with how it comes back.
    const handovers = useQuery({ queryKey: ['handovers', 'Completed'], queryFn: () => handoversApi.list({ status: 'Completed', page: 1, pageSize: 100 }) });
    const handedOver = current && handovers.data?.items?.find((h) => h.contractId === current.contractId);
    const done = () => {
        ['returns', 'contracts', 'storage-units', 'deposit-refunds'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
        setSelected(null);
    };
    const isStaff = [Roles.FacilityStaff, Roles.FacilityManager].includes(session?.role);

    return (
        <>
            <PageHeader title={tr('Returns')} subtitle="Inspect returned units, settle deposits and release units" />
            {toast && (
                <div className="se-alert info sa-toast" role="status">
                    <span>
                        {toast.refundAmount > 0
                            ? <>{tr('Refund of {amount} is awaiting payout', { amount: formatVnd(toast.refundAmount) })} · <Link to="/admin/deposit-refunds" className="se-link">{tr('Go to payout')}</Link></>
                            : tr('Settlement finalized. No refund due.')}
                    </span>
                    <button type="button" className="sa-close" onClick={() => setToast(null)} aria-label={tr('Close')}>×</button>
                </div>
            )}
            <div className="sa-stats">
                <Stat icon="arrowLeft" label="Return requests" value={all.filter((m) => m.status === 'Requested').length} />
                <Stat icon="calendar" label="Inspections booked" value={all.filter((m) => m.status === 'Approved').length} />
                <Stat icon="card" tone="warn" label="Awaiting refund" value={all.filter((m) => m.status === 'Inspected').length} />
                <Stat icon="check" label="Settled" value={all.filter((m) => m.status === 'Completed').length} />
            </div>
            <div className="se-tabs se-tabs-line" role="tablist">
                {TABS.map((t) => (
                    <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => { setTab(t); setSelected(null); }}>
                        {tr(t === 'Completed' ? 'Settled' : humanize(t))} <span className="se-count">{all.filter((m) => m.status === t).length}</span>
                    </button>
                ))}
            </div>
            <div className="sa-split">
                <div className="se-card se-table-wrap">
                    <table className="se-table sa-table">
                        <thead><tr><th>{tr('Customer')}</th><th>{tr('Unit')}</th><th>{tr('Contract')}</th><th>{tr('Return date')}</th><th>{tr('Move out by')}</th><th>{tr('Inspection')}</th><th>{tr('Status')}</th></tr></thead>
                        <tbody>
                            {shown.map((m) => (
                                <tr key={m.unitReturnId} className={selected === m.unitReturnId ? 'active' : ''} onClick={() => setSelected(m.unitReturnId)}>
                                    <td className="strong">{m.customerName}</td>
                                    <td>{m.unitCode}</td>
                                    <td>{m.contractNumber}</td>
                                    <td>{formatDate(m.plannedReturnDate)}</td>
                                    <td>{formatDate(m.moveOutDeadline)}{m.accessLockedAt && <span className="se-badge none">{tr('Locked')}</span>}</td>
                                    <td>{m.inspectionSlot ? formatDateTime(m.inspectionSlot) : '—'}</td>
                                    <td><ReturnStatus item={m} refundMap={refundMap} /></td>
                                </tr>
                            ))}
                            <TableState query={returns} rows={shown} cols={7} empty="Nothing in this list." />
                        </tbody>
                    </table>
                </div>
                {current && (
                    <Modal narrow onClose={() => setSelected(null)}><aside className="se-panel sa-side-panel">
                        <div className="sa-card-title"><h2>{tr('Unit')} {current.unitCode} <ReturnStatus item={current} refundMap={refundMap} /></h2>
                            <button type="button" className="sa-close" onClick={() => setSelected(null)} aria-label={tr('Close')}><Icon name="close" size={16} /></button></div>
                        <p className="sa-muted">{current.customerName} · {current.contractNumber}</p>
                        <dl className="se-kv">
                            <div><dt>{tr('Requested')}</dt><dd>{formatDateTime(current.requestedAt)}</dd></div>
                            <div><dt>{tr('Planned return')}</dt><dd>{formatDate(current.plannedReturnDate)}</dd></div>
                            <div><dt>{tr('Move out by')}</dt><dd>{formatDate(current.moveOutDeadline)}</dd></div>
                            <div><dt>{tr('Reason')}</dt><dd>{current.reason || '—'}</dd></div>
                            <div><dt>{tr('Condition at handover')}</dt><dd>{handedOver?.conditionNote || tr('No note taken')}{handedOver ? ` · ${formatDate(handedOver.handoverTime)}` : ''}</dd></div>
                            <div><dt>{tr('Refund to')}</dt><dd>{tr(humanize(current.refundMethod))}{current.refundAccount ? ` · ${current.refundAccount}` : ''}</dd></div>
                            {current.inspection && <div><dt>{tr('Inspection')}</dt><dd>{tr(humanize(current.inspection.conditionResult))} · refund {formatVnd(current.inspection.refundAmount)}</dd></div>}
                        </dl>
                        {handedOver && <HandoverPhotos handover={handedOver} />}
                        {current.accessLockedAt && <div className="se-alert" role="alert">Past the move-out deadline: access was locked on {formatDateTime(current.accessLockedAt)}. Clear the unit out, then inspect it.</div>}
                        {current.status === 'Requested' && isStaff && <Approve request={current} onDone={done} />}
                        {current.status === 'Approved' && isStaff && <Inspect request={current} onDone={done} />}
                        {current.status === 'Inspected' && session?.role === Roles.BusinessOperationsManager && (
                            <Settle request={current} contract={currentContract} invoices={invoices.data} terms={terms.data} onDone={done}
                                onSettled={(s) => { setToast(s); queryClient.invalidateQueries({ queryKey: ['deposit-refunds'] }); }} />
                        )}
                        {current.status === 'Inspected' && session?.role !== Roles.BusinessOperationsManager && <p className="sa-muted">{tr('A Business Operations Manager settles the deposit.')}</p>}
                    </aside></Modal>
                )}
            </div>
        </>
    );
}
