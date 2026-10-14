import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../../customer/components/Icon.jsx';
import { formatDate, formatVnd } from '../../customer/components/format.js';
import { Filters, PageHeader, SearchFilter, Stat, Status, TableState, matches } from '../components/ui.jsx';
import { useContracts, useInvoices } from '../queries.js';

const OPEN = ['Issued', 'Overdue'];

/** A17: record a payment taken at the desk against an open invoice. */
export default function RecordPaymentPage() {
    const [params] = useSearchParams();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(Number(params.get('invoiceId')) || null);
    const [amount, setAmount] = useState('');
    const [reference, setReference] = useState('');
    const invoices = useInvoices();
    const contracts = useContracts();
    const contractOf = Object.fromEntries((contracts.data ?? []).map((c) => [c.contractId, c]));
    const all = invoices.data ?? [];
    const open = all.filter((i) => OPEN.includes(i.status));
    const shown = open.filter((i) => matches(search, i.invoiceNumber, contractOf[i.contractId]?.customerName, contractOf[i.contractId]?.unitCode));
    const invoice = all.find((i) => i.invoiceId === selected);
    const value = amount === '' ? invoice?.outstandingAmount : Number(amount);
    const valid = invoice && value > 0 && value <= invoice.outstandingAmount;

    const pay = useMutation({
        mutationFn: () => invoicesApi.paymentsManual(invoice.invoiceId, { amount: value, referenceNo: reference.trim() || null }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['invoices'] }); setAmount(''); setReference(''); },
    });

    return (
        <>
            <PageHeader title="Record a payment" subtitle="Enter payments taken at the front desk against an open invoice" />
            <div className="sa-stats">
                <Stat icon="card" label="Unpaid invoices" value={open.length} note={formatVnd(open.reduce((s, i) => s + (i.outstandingAmount ?? 0), 0))} />
                <Stat icon="clock" tone="bad" label="Overdue" value={open.filter((i) => i.status === 'Overdue').length} />
                <Stat icon="check" label="Paid invoices" value={all.filter((i) => i.status === 'Paid').length} />
            </div>
            <div className={`sa-split${invoice ? ' open' : ''}`}>
                <div>
                    <Filters><SearchFilter value={search} onChange={setSearch} placeholder="Search customer, unit or invoice" /></Filters>
                    <div className="se-card se-table-wrap">
                        <table className="se-table sa-table">
                            <thead><tr><th>Invoice</th><th>Customer</th><th>Unit</th><th>Due</th><th>Outstanding</th><th>Status</th></tr></thead>
                            <tbody>
                                {shown.map((i) => (
                                    <tr key={i.invoiceId} className={selected === i.invoiceId ? 'active' : ''} onClick={() => { setSelected(i.invoiceId); setAmount(''); pay.reset(); }}>
                                        <td className="strong">{i.invoiceNumber}</td>
                                        <td>{contractOf[i.contractId]?.customerName ?? '—'}</td>
                                        <td>{contractOf[i.contractId]?.unitCode ?? '—'}</td>
                                        <td>{formatDate(i.dueDate)}</td>
                                        <td className="price">{formatVnd(i.outstandingAmount)}</td>
                                        <td><Status value={i.status} /></td>
                                    </tr>
                                ))}
                                <TableState query={invoices} rows={shown} cols={6} empty="No unpaid invoices." />
                            </tbody>
                        </table>
                    </div>
                </div>
                {invoice && (
                    <form className="se-panel sa-side-panel" onSubmit={(e) => { e.preventDefault(); if (valid) pay.mutate(); }}>
                        <div className="sa-card-title"><h2>{invoice.invoiceNumber} <Status value={invoice.status} /></h2>
                            <button type="button" className="sa-close" onClick={() => setSelected(null)} aria-label="Close"><Icon name="arrowLeft" size={16} /></button></div>
                        {contractOf[invoice.contractId] && <p className="sa-muted"><Link to={`/admin/customers/${contractOf[invoice.contractId].customerId}`} className="se-link">{contractOf[invoice.contractId].customerName}</Link> · Unit {contractOf[invoice.contractId].unitCode}</p>}
                        <dl className="se-kv">
                            {invoice.items?.map((it) => <div key={it.invoiceItemId}><dt>{it.description}</dt><dd>{formatVnd(it.lineAmount)}</dd></div>)}
                            <div><dt>Total</dt><dd>{formatVnd(invoice.totalAmount)}</dd></div>
                            <div><dt>Already paid</dt><dd>{formatVnd(invoice.paidAmount)}</dd></div>
                            <div><dt><strong>Outstanding</strong></dt><dd>{formatVnd(invoice.outstandingAmount)}</dd></div>
                        </dl>
                        {OPEN.includes(invoice.status) ? (
                            <>
                                <label><span className="se-label">Amount received (₫)</span>
                                    <div className="se-input"><input type="number" min="1" max={invoice.outstandingAmount} value={amount === '' ? invoice.outstandingAmount : amount} onChange={(e) => setAmount(e.target.value)} required /></div></label>
                                <label><span className="se-label">Receipt / transfer reference (optional)</span>
                                    <div className="se-input"><input maxLength={50} value={reference} onChange={(e) => setReference(e.target.value)} /></div></label>
                                {!valid && <p className="sa-bad">Enter an amount between 1 and the outstanding balance.</p>}
                                {pay.isError && <div className="se-alert" role="alert">{errorMessage(pay.error)}</div>}
                                <button type="submit" className="se-btn se-btn-primary se-btn-block" disabled={!valid || pay.isPending}>{pay.isPending ? 'Recording…' : `Record ${formatVnd(value)}`}</button>
                            </>
                        ) : <div className="se-alert info">Payment recorded — this invoice is {invoice.status.toLowerCase()}.</div>}
                    </form>
                )}
            </div>
        </>
    );
}
