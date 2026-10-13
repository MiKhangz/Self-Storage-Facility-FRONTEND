import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { formatDate, formatVnd } from '../components/format.js';
import PayInvoiceButton from './PayInvoiceButton.jsx';
import { LIVE_CONTRACT, OPEN_INVOICE, invoiceBadge, useMyContracts, useMyInvoices } from './queries.js';
import './MyStoragePage.css';

const TABS = [
    { key: 'all', label: 'All invoices', match: () => true },
    { key: 'unpaid', label: 'Unpaid', match: (i) => OPEN_INVOICE.includes(i.status) },
    { key: 'paid', label: 'Paid', match: (i) => i.status === 'Paid' },
];

/** U14: every invoice the customer has, with online payment for the open ones. */
export default function PaymentsPage() {
    const [tab, setTab] = useState('all');
    const invoices = useMyInvoices();
    const contracts = useMyContracts();
    const all = invoices.data?.items ?? [];
    const unitOf = Object.fromEntries((contracts.data?.items ?? []).map((c) => [c.contractId, c.unitCode]));
    const open = all.filter((i) => OPEN_INVOICE.includes(i.status)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const next = open[0];
    const year = new Date().getFullYear().toString();
    const paidThisYear = all.filter((i) => i.issueDate?.startsWith(year));
    const deposit = (contracts.data?.items ?? [])
        .filter((c) => LIVE_CONTRACT.includes(c.status) && c.status !== 'Draft')
        .reduce((sum, c) => sum + (c.depositAmount ?? 0), 0);
    const shown = all.filter(TABS.find((t) => t.key === tab).match);

    return (
        <>
            <div className="se-account-title">
                <div><h1>Payments &amp; invoices</h1><p>Every invoice for your units, and how you pay them.</p></div>
            </div>

            {invoices.isError && <div className="se-alert" role="alert">Invoices could not be loaded. Please refresh the page.</div>}

            {next && (
                <div className={`se-due${next.status === 'Overdue' ? ' overdue' : ''}`}>
                    <Icon name="clock" size={20} />
                    <div>
                        <strong>{formatVnd(next.outstandingAmount)} {next.status === 'Overdue' ? 'overdue since' : 'due on'} {formatDate(next.dueDate)}</strong>
                        <small>Invoice {next.invoiceNumber}{unitOf[next.contractId] ? ` · unit ${unitOf[next.contractId]}` : ''}</small>
                    </div>
                    <PayInvoiceButton invoice={next} className="se-btn se-btn-amber se-btn-sm">Pay now</PayInvoiceButton>
                </div>
            )}

            <div className="se-stats">
                <div className="se-card se-stat"><span className="se-stat-label">Outstanding</span>
                    <strong>{formatVnd(open.reduce((s, i) => s + (i.outstandingAmount ?? 0), 0))}</strong><small>{open.length} unpaid {open.length === 1 ? 'invoice' : 'invoices'}</small></div>
                <div className="se-card se-stat"><span className="se-stat-label">Paid in {year}</span>
                    <strong>{formatVnd(paidThisYear.reduce((s, i) => s + (i.paidAmount ?? 0), 0))}</strong><small>{paidThisYear.length} invoices</small></div>
                <div className="se-card se-stat"><span className="se-stat-label">Deposits held</span>
                    <strong>{formatVnd(deposit)}</strong><small>refundable</small></div>
            </div>

            <div className="se-tabs se-tabs-line" role="tablist">
                {TABS.map((t) => (
                    <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
                        {t.label} <span className="se-count">{all.filter(t.match).length}</span>
                    </button>
                ))}
            </div>

            <div className="se-card se-table-wrap">
                <table className="se-table">
                    <thead><tr><th>Invoice</th><th>Date</th><th>Unit</th><th>Description</th><th>Amount</th><th>Status</th><th /></tr></thead>
                    <tbody>
                        {shown.map((inv) => {
                            const [tone, label] = invoiceBadge(inv);
                            return (
                                <tr key={inv.invoiceId}>
                                    <td className="strong">{inv.invoiceNumber}</td>
                                    <td>{formatDate(inv.issueDate)}</td>
                                    <td>{unitOf[inv.contractId] ?? '—'}</td>
                                    <td>{inv.items?.map((it) => it.description).join(', ') || '—'}</td>
                                    <td className="price">{formatVnd(inv.totalAmount)}</td>
                                    <td><span className={`se-badge ${tone}`}>{label}</span></td>
                                    <td>{OPEN_INVOICE.includes(inv.status) && <PayInvoiceButton invoice={inv} />}</td>
                                </tr>
                            );
                        })}
                        {!shown.length && <tr><td colSpan={7} className="se-empty">{invoices.isLoading ? 'Loading…' : 'No invoices here.'}</td></tr>}
                    </tbody>
                </table>
            </div>
        </>
    );
}
