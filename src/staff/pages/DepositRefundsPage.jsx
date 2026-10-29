import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { depositRefundsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { useAuth } from '../../features/auth/AuthContext';
import { Roles } from '../../features/auth/roles';
import Icon from '../../customer/components/Icon.jsx';
import { formatDate, formatVnd } from '../../customer/components/format.js';
import { Filters, PageHeader, SearchFilter, SelectFilter, Stat, Status, TableState, matches } from '../components/ui.jsx';
import { fetchAll, humanize } from '../queries.js';
import { useT } from '../../i18n/I18n.jsx';

const SOURCE = { Cancellation: 'Booking cancelled', Return: 'Unit handed back' };

/** Business Operations record how the deposit went back; the customer sees it as paid on their Payments page. */
function PayPanel({ refund, onClose }) {
    const tr = useT();
    const queryClient = useQueryClient();
    const [method, setMethod] = useState(refund.method ?? 'Cash');
    const [reference, setReference] = useState('');
    const pay = useMutation({
        mutationFn: () => depositRefundsApi.paid(refund.depositRefundId, { method, referenceNo: reference.trim() || null }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deposit-refunds'] }),
    });
    const needsReference = method === 'BankTransfer' && !reference.trim();
    return (
        <form className="se-panel sa-side-panel" onSubmit={(e) => {
            e.preventDefault();
            if (window.confirm(`Mark ${formatVnd(refund.amount)} as paid back to ${refund.customerName}?`)) pay.mutate();
        }}>
            <div className="sa-card-title"><h2>{formatVnd(refund.amount)}</h2>
                <button type="button" className="sa-close" onClick={onClose} aria-label={tr('Close')}><Icon name="arrowLeft" size={16} /></button></div>
            <p className="sa-muted"><Link to={`/admin/customers/${refund.customerId}`} className="se-link">{refund.customerName}</Link> · {refund.customerPhone}</p>
            <dl className="se-kv">
                <div><dt>{tr('Why')}</dt><dd>{SOURCE[refund.source]}</dd></div>
                <div><dt>{tr('Booking')}</dt><dd>{refund.reservationCode}</dd></div>
                <div><dt>{tr('Facility')}</dt><dd>{refund.facilityName}</dd></div>
                <div><dt>{tr('Owed since')}</dt><dd>{formatDate(refund.createdAt)}</dd></div>
                {refund.refundAccount && <div><dt>{tr('Customer\'s account')}</dt><dd>{refund.refundAccount}</dd></div>}
            </dl>
            <label><span className="se-label">{tr('Paid by')}</span>
                <div className="se-field"><select value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="Cash">{tr('Cash at the facility')}</option>
                    <option value="BankTransfer">{tr('Bank transfer')}</option>
                </select></div></label>
            <label><span className="se-label">Transfer reference{method === 'BankTransfer' ? ' *' : ' (optional)'}</span>
                <div className="se-input"><input maxLength={50} value={reference} onChange={(e) => setReference(e.target.value)} /></div></label>
            {pay.isError && <div className="se-alert" role="alert">{errorMessage(pay.error)}</div>}
            <button type="submit" className="se-btn se-btn-primary se-btn-block" disabled={needsReference || pay.isPending}>
                {pay.isPending ? tr('Saving…') : tr('Mark as paid')}</button>
        </form>
    );
}

/** Deposits owed back after a cancelled booking or a settled return, until someone pays them. */
export default function DepositRefundsPage() {
    const tr = useT();
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('Pending');
    const [selected, setSelected] = useState(null);
    const canPay = useAuth().session?.role === Roles.BusinessOperationsManager;
    const refunds = useQuery({ queryKey: ['deposit-refunds', status], queryFn: () => fetchAll(depositRefundsApi.list, { status: status || undefined }) });
    const all = refunds.data ?? [];
    const shown = all.filter((r) => matches(search, r.customerName, r.customerPhone, r.reservationCode, r.facilityName));
    const current = all.find((r) => r.depositRefundId === selected);
    const pending = all.filter((r) => r.status === 'Pending');

    return (
        <>
            <PageHeader title={tr('Deposit refunds')} subtitle="Deposits owed back after a cancellation or a return, until they are paid" />
            <div className="sa-stats">
                <Stat icon="clock" tone="warn" label="Waiting to be paid" value={pending.length} note={formatVnd(pending.reduce((s, r) => s + r.amount, 0))} />
                <Stat icon="check" label="Paid (in this list)" value={all.filter((r) => r.status === 'Paid').length} />
            </div>
            <Filters>
                <SearchFilter value={search} onChange={setSearch} placeholder={tr('Search customer, phone, booking or facility')} />
                <SelectFilter label="Status" value={status} onChange={(v) => { setStatus(v); setSelected(null); }} all="All" options={['Pending', 'Paid'].map((s) => ({ value: s, label: humanize(s) }))} />
            </Filters>
            <div className={`sa-split${current && canPay && current.status === 'Pending' ? ' open' : ''}`}>
                <div className="se-card se-table-wrap">
                    <table className="se-table sa-table">
                        <thead><tr><th>{tr('Customer')}</th><th>{tr('Why')}</th><th>{tr('Booking')}</th><th>{tr('Amount')}</th><th>{tr('Owed since')}</th><th>{tr('Paid')}</th><th>{tr('Status')}</th></tr></thead>
                        <tbody>
                            {shown.map((r) => (
                                <tr key={r.depositRefundId} className={selected === r.depositRefundId ? 'active' : ''} onClick={() => setSelected(r.depositRefundId)}>
                                    <td className="strong">{r.customerName}<div className="sa-muted">{r.facilityName}</div></td>
                                    <td>{SOURCE[r.source]}</td>
                                    <td>{r.reservationCode}</td>
                                    <td className="price">{formatVnd(r.amount)}</td>
                                    <td>{formatDate(r.createdAt)}</td>
                                    <td>{r.paidAt ? <>{formatDate(r.paidAt)} · {tr(humanize(r.method))}{r.referenceNo ? ` · ${r.referenceNo}` : ''}<div className="sa-muted">{r.paidByName}</div></> : '—'}</td>
                                    <td><Status value={r.status} /></td>
                                </tr>
                            ))}
                            <TableState query={refunds} rows={shown} cols={7} empty={status === 'Pending' ? tr('No deposit is waiting to be paid back.') : tr('Nothing in this list.')} />
                        </tbody>
                    </table>
                </div>
                {current && canPay && current.status === 'Pending' && <PayPanel key={current.depositRefundId} refund={current} onClose={() => setSelected(null)} />}
            </div>
        </>
    );
}
