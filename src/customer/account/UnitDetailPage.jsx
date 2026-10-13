import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accessLogsApi, contractsApi, renewalsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import { addMonths, formatDate, formatVnd, todayIso } from '../components/format.js';
import PayInvoiceButton from './PayInvoiceButton.jsx';
import { OPEN_INVOICE, invoiceBadge, periodUsed, useMyInvoices, useMyReservations } from './queries.js';
import './MyStoragePage.css';
import './UnitDetailPage.css';

const RENEW_OPTIONS = [{ months: 1 }, { months: 3, note: '−5%' }, { months: 6, note: '−10%' }, { months: 12, note: '−10%' }];
const formatTime = (iso) => new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function AccessCodeCard({ contract }) {
    const queryClient = useQueryClient();
    const [code, setCode] = useState(null);
    const [shown, setShown] = useState(true);
    const summary = useQuery({
        queryKey: ['contracts', contract.contractId, 'access-code'],
        queryFn: () => contractsApi.accessCode(contract.contractId),
        enabled: contract.status === 'Active',
    });
    // The backend stores only a hash, so the digits exist on screen only right after a new code is issued.
    const issue = useMutation({
        mutationFn: () => contractsApi.accessCodesRequest(contract.contractId),
        onSuccess: (dto) => {
            setCode(dto.code);
            setShown(true);
            queryClient.invalidateQueries({ queryKey: ['contracts', contract.contractId, 'access-code'] });
        },
    });

    if (contract.status !== 'Active') {
        return (
            <section className="se-code-card">
                <h2><Icon name="key" size={18} /> Your personal access code</h2>
                <p className="se-code-note">Your code is issued when staff complete your check-in.</p>
            </section>
        );
    }

    const digits = code ? code.split('') : Array(6).fill('•');
    return (
        <section className="se-code-card">
            <h2><Icon name="key" size={18} /> Your personal access code</h2>
            <div className="se-code-digits" aria-label={code && shown ? `Access code ${code}` : 'Access code hidden'}>
                {digits.map((d, i) => <span key={i}>{code && shown ? d : '•'}</span>)}
            </div>
            <div className="se-code-actions">
                {code && <button type="button" onClick={() => setShown(!shown)}><Icon name={shown ? 'eyeOff' : 'eye'} size={14} /> {shown ? 'Hide code' : 'Show code'}</button>}
                <button type="button" onClick={() => issue.mutate()} disabled={issue.isPending}><Icon name="key" size={14} /> {issue.isPending ? 'Issuing…' : 'Get a new code'}</button>
            </div>
            {issue.isError && <p className="se-code-note error">{errorMessage(issue.error)}</p>}
            <p className="se-code-note">
                {code ? 'Write this code down now — it will not be shown again. ' : ''}
                {summary.data?.isActive ? `Current code valid until ${formatDate(summary.data.expiresAt)}.` : 'No active code — get a new one to open the gate.'} Never share this code.
            </p>
        </section>
    );
}

function RenewCard({ contract }) {
    const queryClient = useQueryClient();
    const [months, setMonths] = useState(6);
    const renewals = useQuery({ queryKey: ['renewals', contract.contractId], queryFn: () => renewalsApi.list({ contractId: contract.contractId, page: 1, pageSize: 10 }) });
    const renew = useMutation({
        mutationFn: () => renewalsApi.create({ contractId: contract.contractId, extendMonths: months }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['renewals', contract.contractId] }),
    });
    const pending = renewals.data?.items?.find((r) => r.status === 'Pending');

    return (
        <section className="se-panel">
            <h2><Icon name="calendar" size={18} /> Renew rental</h2>
            <p className="se-hint">Current period ends {formatDate(contract.endDate)}. Renew to keep your unit; a manager approves the new end date and rent.</p>
            {pending ? (
                <div className="se-alert info">
                    Renewal of +{pending.extendMonths} months requested — new end date {formatDate(pending.newEndDate)}, {formatVnd(pending.newMonthlyRent)} / month. Waiting for approval.
                </div>
            ) : (
                <>
                    <div className="se-chips" role="radiogroup" aria-label="Renewal length">
                        {RENEW_OPTIONS.map((o) => (
                            <button key={o.months} type="button" role="radio" aria-checked={months === o.months}
                                className={`se-chip${months === o.months ? ' active' : ''}`} onClick={() => setMonths(o.months)}>
                                {months === o.months && <Icon name="check" size={14} />}+{o.months} {o.months === 1 ? 'month' : 'months'} {o.note && <small>{o.note}</small>}
                            </button>
                        ))}
                    </div>
                    <div className="se-renew-preview">New end date: <strong>{formatDate(addMonths(contract.endDate, months))}</strong></div>
                    {renew.isError && <div className="se-alert" role="alert">{errorMessage(renew.error)}</div>}
                    <button type="button" className="se-btn se-btn-primary se-btn-block" onClick={() => renew.mutate()} disabled={renew.isPending}>
                        {renew.isPending ? 'Sending…' : 'Request renewal'}
                    </button>
                </>
            )}
        </section>
    );
}

/** U10: one rented unit — access code, renewal, contract, payments and access log. */
export default function UnitDetailPage() {
    const contractId = Number(useParams().contractId);
    const queryClient = useQueryClient();
    const contract = useQuery({ queryKey: ['contracts', contractId], queryFn: () => contractsApi.getById(contractId) });
    const reservations = useMyReservations();
    const invoices = useMyInvoices();
    const logs = useQuery({ queryKey: ['access-logs', 'mine'], queryFn: () => accessLogsApi.mine({ page: 1, pageSize: 50 }) });
    const sign = useMutation({
        mutationFn: () => contractsApi.sign(contractId),
        onSuccess: (dto) => {
            queryClient.setQueryData(['contracts', contractId], dto);
            queryClient.invalidateQueries({ queryKey: ['contracts'] });
        },
    });

    if (contract.isLoading) return <p className="se-empty">Loading unit…</p>;
    if (contract.isError) return <div className="se-alert" role="alert">{errorMessage(contract.error)}</div>;

    const c = contract.data;
    const r = reservations.data?.items?.find((x) => x.reservationId === c.reservationId);
    const mine = (invoices.data?.items ?? []).filter((i) => i.contractId === contractId);
    const due = mine.filter((i) => OPEN_INVOICE.includes(i.status)).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    const myLogs = (logs.data?.items ?? []).filter((l) => l.contractId === contractId).slice(0, 6);
    const live = ['Active', 'Overdue', 'Suspended'].includes(c.status);
    const used = periodUsed(c.startDate, c.endDate, todayIso());

    return (
        <>
            <Link to="/my-storage" className="se-back"><Icon name="arrowLeft" size={16} /> Back to My units</Link>
            <div className="se-account-title">
                <div>
                    <h1>Unit {c.unitCode} <span className={`se-badge ${c.status === 'Active' ? '' : 'low'}`}>{c.status}</span></h1>
                    <p>{[r?.unitTypeName, r?.facilityName].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="se-title-actions">
                    <Link to={`/support/new?contractId=${contractId}`} className="se-btn se-btn-ghost"><Icon name="shield" size={16} /> Report a problem</Link>
                    {live && <Link to={`/move-out?contractId=${contractId}`} className="se-btn se-btn-danger">Request move-out</Link>}
                </div>
            </div>

            {c.status === 'Draft' && !c.signedAt && (
                <div className="se-due">
                    <Icon name="file" size={20} />
                    <div><strong>Please sign your rental contract</strong><small>Your unit is handed over and activated after you sign.</small></div>
                    <button type="button" className="se-btn se-btn-amber se-btn-sm" onClick={() => sign.mutate()} disabled={sign.isPending}>{sign.isPending ? 'Signing…' : 'Sign contract'}</button>
                </div>
            )}
            {sign.isError && <div className="se-alert" role="alert">{errorMessage(sign.error)}</div>}

            <div className="se-detail-grid">
                <div>
                    <AccessCodeCard contract={c} />
                    {live && <RenewCard contract={c} />}
                    <section className="se-panel">
                        <h2>Payment history</h2>
                        <div className="se-table-wrap">
                            <table className="se-table">
                                <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
                                <tbody>
                                    {mine.map((inv) => {
                                        const [tone, label] = invoiceBadge(inv);
                                        return (
                                            <tr key={inv.invoiceId}>
                                                <td>{formatDate(inv.issueDate)}</td>
                                                <td>{inv.items?.[0]?.description ?? inv.invoiceNumber}</td>
                                                <td className="price">{formatVnd(inv.totalAmount)}</td>
                                                <td><span className={`se-badge ${tone}`}>{label}</span></td>
                                            </tr>
                                        );
                                    })}
                                    {!mine.length && <tr><td colSpan={4} className="se-empty">No invoices for this unit yet.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                <aside>
                    {due && (
                        <div className="se-due-card">
                            <strong>{formatVnd(due.outstandingAmount)} due {formatDate(due.dueDate)}</strong>
                            <small>{due.items?.[0]?.description ?? due.invoiceNumber}</small>
                            <PayInvoiceButton invoice={due} className="se-btn se-btn-amber se-btn-block se-btn-sm">Pay now</PayInvoiceButton>
                        </div>
                    )}
                    <section className="se-panel">
                        <h2>Contract</h2>
                        <dl className="se-kv">
                            <div><dt>Contract no.</dt><dd>{c.contractNumber}</dd></div>
                            <div><dt>Start date</dt><dd>{formatDate(c.startDate)}</dd></div>
                            <div><dt>End date</dt><dd>{formatDate(c.endDate)}</dd></div>
                            <div><dt>Monthly rent</dt><dd>{formatVnd(c.monthlyRent)}</dd></div>
                            <div><dt>Deposit held</dt><dd>{formatVnd(c.depositAmount)}</dd></div>
                            <div><dt>Payment day</dt><dd>Day {c.paymentDay} monthly</dd></div>
                            <div><dt>Signed</dt><dd>{c.signedAt ? formatDate(c.signedAt) : 'Not yet'}</dd></div>
                        </dl>
                        {live && <>
                            <p className="se-hint">{used}% of rental period used</p>
                            <div className="se-progress flat"><span style={{ width: `${used}%` }} /></div>
                        </>}
                    </section>
                    <section className="se-panel">
                        <h2>Access log</h2>
                        <ul className="se-log">
                            {myLogs.map((l) => <li key={l.accessLogId}><strong>{formatTime(l.accessTime)}</strong> {l.result}</li>)}
                            {!myLogs.length && <li className="se-hint">No gate activity yet.</li>}
                        </ul>
                    </section>
                </aside>
            </div>
        </>
    );
}
