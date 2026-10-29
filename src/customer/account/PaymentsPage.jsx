import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { depositRefundsApi } from '../../api/generated';
import Icon from '../components/Icon.jsx';
import { formatDate, formatVnd } from '../components/format.js';
import PayInvoiceButton from './PayInvoiceButton.jsx';
import { LIVE_CONTRACT, OPEN_INVOICE, invoiceBadge, useMyContracts, useMyInvoices } from './queries.js';
import './MyStoragePage.css';
import { useT } from '../../i18n/I18n.jsx';

const TABS = [
    { key: 'all', label: 'Tất cả hóa đơn', match: () => true },
    { key: 'unpaid', label: 'Chưa thanh toán', match: (i) => OPEN_INVOICE.includes(i.status) },
    { key: 'paid', label: 'Đã thanh toán', match: (i) => i.status === 'Paid' },
];

/** Deposits StorEase owes back, so the customer can see whether theirs has been paid yet. */
function DepositRefunds() {
    const t = useT();
    const refunds = useQuery({ queryKey: ['deposit-refunds', 'mine'], queryFn: () => depositRefundsApi.list({ page: 1, pageSize: 50 }) });
    const list = refunds.data?.items ?? [];
    if (!list.length) return null;
    return (
        <>
            <h2 className="se-account-section">{t('Tiền cọc hoàn lại')}</h2>
            <div className="se-card se-table-wrap">
                <table className="se-table se-stack">
                    <thead><tr><th>{t('Mã đặt kho')}</th><th>{t('Lý do')}</th><th>{t('Số tiền')}</th><th>{t('Trạng thái')}</th></tr></thead>
                    <tbody>
                        {list.map((r) => (
                            <tr key={r.depositRefundId}>
                                <td className="strong se-stack-title">{r.reservationCode}</td>
                                <td data-label={t('Lý do')}>{t(r.source === 'Return' ? 'Trả kho' : 'Huỷ đặt kho')}</td>
                                <td data-label={t('Số tiền')} className="price">{formatVnd(r.amount)}</td>
                                <td data-label={t('Trạng thái')}>
                                    {r.status === 'Paid'
                                        ? <span className="se-badge">{t('Đã hoàn {date}', { date: formatDate(r.paidAt) })} · {t(r.method === 'BankTransfer' ? 'chuyển khoản' : 'tiền mặt')}</span>
                                        : <span className="se-badge low">{t('Đang chờ hoàn')}</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}

/** U14: every invoice the customer has, with online payment for the open ones. */
export default function PaymentsPage() {
    const [tab, setTab] = useState('all');
    const t = useT();
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
    const shown = all.filter(TABS.find((x) => x.key === tab).match);

    return (
        <>
            <div className="se-account-title">
                <div><h1>{t('Thanh toán và hóa đơn')}</h1><p>{t('Tất cả hóa đơn của các kho bạn thuê và cách thanh toán.')}</p></div>
            </div>

            {invoices.isError && <div className="se-alert" role="alert">{t('Không tải được danh sách hóa đơn. Vui lòng tải lại trang.')}</div>}

            {next && (
                <div className={`se-due${next.status === 'Overdue' ? ' overdue' : ''}`}>
                    <Icon name="clock" size={20} />
                    <div>
                        <strong>{formatVnd(next.outstandingAmount)} {t(next.status === 'Overdue' ? 'đã quá hạn từ' : 'đến hạn ngày')} {formatDate(next.dueDate)}</strong>
                        <small>{t('Hóa đơn')} {next.invoiceNumber}{unitOf[next.contractId] ? ` · ${t('Kho')} ${unitOf[next.contractId]}` : ''}</small>
                    </div>
                    <PayInvoiceButton invoice={next} className="se-btn se-btn-primary se-btn-sm">{t('Thanh toán ngay')}</PayInvoiceButton>
                </div>
            )}

            <div className="se-stats">
                <div className="se-card se-stat"><span className="se-stat-label">{t('Cần thanh toán')}</span>
                    <strong>{formatVnd(open.reduce((s, i) => s + (i.outstandingAmount ?? 0), 0))}</strong><small>{t('{n} hóa đơn chưa thanh toán', { n: open.length })}</small></div>
                <div className="se-card se-stat"><span className="se-stat-label">{t('Đã thanh toán năm {year}', { year })}</span>
                    <strong>{formatVnd(paidThisYear.reduce((s, i) => s + (i.paidAmount ?? 0), 0))}</strong><small>{t('{n} hóa đơn', { n: paidThisYear.length })}</small></div>
                <div className="se-card se-stat"><span className="se-stat-label">{t('Tiền cọc đang giữ')}</span>
                    <strong>{formatVnd(deposit)}</strong><small>{t('được hoàn lại khi trả kho')}</small></div>
            </div>

            <div className="se-tabs se-tabs-line" role="tablist">
                {TABS.map((x) => (
                    <button key={x.key} role="tab" aria-selected={tab === x.key} className={tab === x.key ? 'active' : ''} onClick={() => setTab(x.key)}>
                        {t(x.label)} <span className="se-count">{all.filter(x.match).length}</span>
                    </button>
                ))}
            </div>

            <div className="se-card se-table-wrap">
                <table className="se-table se-stack">
                    <thead><tr><th>{t('Hóa đơn')}</th><th>{t('Ngày lập')}</th><th>{t('Kho')}</th><th>{t('Nội dung')}</th><th>{t('Số tiền')}</th><th>{t('Trạng thái')}</th><th><span className="sr-only">{t('Thao tác')}</span></th></tr></thead>
                    <tbody>
                        {shown.map((inv) => {
                            const [tone, label] = invoiceBadge(inv, t);
                            return (
                                <tr key={inv.invoiceId}>
                                    <td className="strong se-stack-title">{inv.invoiceNumber}</td>
                                    <td data-label={t('Ngày lập')}>{formatDate(inv.issueDate)}</td>
                                    <td data-label={t('Kho')}>{unitOf[inv.contractId] ?? '—'}</td>
                                    <td data-label={t('Nội dung')}>{inv.items?.map((it) => it.description).join(', ') || '—'}</td>
                                    <td data-label={t('Số tiền')} className="price">{formatVnd(inv.totalAmount)}</td>
                                    <td data-label={t('Trạng thái')}><span className={`se-badge ${tone}`}>{label}</span></td>
                                    <td className="se-stack-action">{OPEN_INVOICE.includes(inv.status) && <PayInvoiceButton invoice={inv} />}</td>
                                </tr>
                            );
                        })}
                        {!shown.length && <tr><td colSpan={7} className="se-empty">{t(invoices.isLoading ? 'Đang tải hóa đơn…' : tab === 'all' ? 'Bạn chưa có hóa đơn nào.' : 'Không có hóa đơn nào trong mục này.')}</td></tr>}
                    </tbody>
                </table>
            </div>

            <DepositRefunds />
        </>
    );
}
