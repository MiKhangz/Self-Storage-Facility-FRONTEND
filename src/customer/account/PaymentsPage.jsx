import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { formatDate, formatVnd } from '../components/format.js';
import PayInvoiceButton from './PayInvoiceButton.jsx';
import { LIVE_CONTRACT, OPEN_INVOICE, invoiceBadge, useMyContracts, useMyInvoices } from './queries.js';
import './MyStoragePage.css';

const TABS = [
    { key: 'all', label: 'Tất cả hóa đơn', match: () => true },
    { key: 'unpaid', label: 'Chưa thanh toán', match: (i) => OPEN_INVOICE.includes(i.status) },
    { key: 'paid', label: 'Đã thanh toán', match: (i) => i.status === 'Paid' },
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
                <div><h1>Thanh toán và hóa đơn</h1><p>Tất cả hóa đơn của các kho bạn thuê và cách thanh toán.</p></div>
            </div>

            {invoices.isError && <div className="se-alert" role="alert">Không tải được danh sách hóa đơn. Vui lòng tải lại trang.</div>}

            {next && (
                <div className={`se-due${next.status === 'Overdue' ? ' overdue' : ''}`}>
                    <Icon name="clock" size={20} />
                    <div>
                        <strong>{formatVnd(next.outstandingAmount)} {next.status === 'Overdue' ? 'đã quá hạn từ' : 'đến hạn ngày'} {formatDate(next.dueDate)}</strong>
                        <small>Hóa đơn {next.invoiceNumber}{unitOf[next.contractId] ? ` · kho ${unitOf[next.contractId]}` : ''}</small>
                    </div>
                    <PayInvoiceButton invoice={next} className="se-btn se-btn-primary se-btn-sm">Thanh toán ngay</PayInvoiceButton>
                </div>
            )}

            <div className="se-stats">
                <div className="se-card se-stat"><span className="se-stat-label">Cần thanh toán</span>
                    <strong>{formatVnd(open.reduce((s, i) => s + (i.outstandingAmount ?? 0), 0))}</strong><small>{open.length} hóa đơn chưa thanh toán</small></div>
                <div className="se-card se-stat"><span className="se-stat-label">Đã thanh toán năm {year}</span>
                    <strong>{formatVnd(paidThisYear.reduce((s, i) => s + (i.paidAmount ?? 0), 0))}</strong><small>{paidThisYear.length} hóa đơn</small></div>
                <div className="se-card se-stat"><span className="se-stat-label">Tiền cọc đang giữ</span>
                    <strong>{formatVnd(deposit)}</strong><small>được hoàn lại khi trả kho</small></div>
            </div>

            <div className="se-tabs se-tabs-line" role="tablist">
                {TABS.map((t) => (
                    <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
                        {t.label} <span className="se-count">{all.filter(t.match).length}</span>
                    </button>
                ))}
            </div>

            <div className="se-card se-table-wrap">
                <table className="se-table se-stack">
                    <thead><tr><th>Hóa đơn</th><th>Ngày lập</th><th>Kho</th><th>Nội dung</th><th>Số tiền</th><th>Trạng thái</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
                    <tbody>
                        {shown.map((inv) => {
                            const [tone, label] = invoiceBadge(inv);
                            return (
                                <tr key={inv.invoiceId}>
                                    <td className="strong se-stack-title">{inv.invoiceNumber}</td>
                                    <td data-label="Ngày lập">{formatDate(inv.issueDate)}</td>
                                    <td data-label="Kho">{unitOf[inv.contractId] ?? '—'}</td>
                                    <td data-label="Nội dung">{inv.items?.map((it) => it.description).join(', ') || '—'}</td>
                                    <td data-label="Số tiền" className="price">{formatVnd(inv.totalAmount)}</td>
                                    <td data-label="Trạng thái"><span className={`se-badge ${tone}`}>{label}</span></td>
                                    <td className="se-stack-action">{OPEN_INVOICE.includes(inv.status) && <PayInvoiceButton invoice={inv} />}</td>
                                </tr>
                            );
                        })}
                        {!shown.length && <tr><td colSpan={7} className="se-empty">{invoices.isLoading ? 'Đang tải hóa đơn…' : tab === 'all' ? 'Bạn chưa có hóa đơn nào.' : 'Không có hóa đơn nào trong mục này.'}</td></tr>}
                    </tbody>
                </table>
            </div>
        </>
    );
}
