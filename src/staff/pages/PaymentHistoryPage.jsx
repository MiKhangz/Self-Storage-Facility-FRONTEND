import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoicesApi, paymentsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { useAuth } from '../../features/auth/AuthContext';
import { Roles } from '../../features/auth/roles';
import { formatDate, formatVnd } from '../../customer/components/format.js';
import { DEMO_RECEIVER_BANK, buildVietQrReference } from '../../customer/account/vietqr.js';
import { Filters, Modal, PageHeader, SearchFilter, SelectFilter, Stat, Status, TableState, matches } from '../components/ui.jsx';
import { fetchAll, humanize, useContracts, useInvoices, useReservations } from '../queries.js';
import { pollIfOnePage } from '../polling.js';
import { useT } from '../../i18n/I18n.jsx';

const RUST_PAYMENT_API = import.meta.env.VITE_PAYMENT_RECEIVER_URL || 'http://localhost:4100';
const { FacilityManager: FM, BusinessOperationsManager: BOM, SystemAdministrator: ADMIN } = Roles;

function formatVietnamTime(iso) {
    if (!iso) return '—';
    const d = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Ho_Chi_Minh',
    });
}

function classifyPaymentId(inv, reservationById, contractById) {
    if (!inv) return { idText: '—', kindLabel: 'Monthly Payment', isBooking: false };
    const num = String(inv.invoiceNumber ?? '');
    if (num.startsWith('DEP') || (!inv.contractId && inv.reservationId)) {
        const res = reservationById[inv.reservationId];
        const code = res?.reservationCode || num.replace(/^DEP/, '') || num;
        return { idText: code, kindLabel: 'Booking', isBooking: true };
    }
    const contract = contractById[inv.contractId];
    return {
        idText: num || contract?.contractNumber || '—',
        kindLabel: 'Monthly Payment',
        isBooking: false,
    };
}

export default function PaymentHistoryPage() {
    const tr = useT();
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [kindFilter, setKindFilter] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');
    const [simModalOpen, setSimModalOpen] = useState(false);
    const [manualModalOpen, setManualModalOpen] = useState(false);

    // MockBankFeed simulator state
    const [simAmount, setSimAmount] = useState('855000');
    const [simDesc, setSimDesc] = useState('RS261127867759 PAY');
    const [simResult, setSimResult] = useState(null);

    // Manual entry fallback state (FINANCE / BOM, FACILITY_MANAGER, ADMIN)
    const canRecordManual = [BOM, FM, ADMIN].includes(session?.role);
    const [manualInvoiceId, setManualInvoiceId] = useState('');
    const [manualAmount, setManualAmount] = useState('');
    const [manualBankRef, setManualBankRef] = useState('');
    const [manualReason, setManualReason] = useState('');
    const [manualEvidence, setManualEvidence] = useState('');

    const payments = useQuery({
        queryKey: ['payments', 'history-all'],
        queryFn: () => fetchAll(paymentsApi.list),
        refetchInterval: pollIfOnePage,
    });
    const invoices = useInvoices();
    const contracts = useContracts();
    const reservations = useReservations();

    const invoiceById = Object.fromEntries((invoices.data ?? []).map((i) => [i.invoiceId, i]));
    const contractById = Object.fromEntries((contracts.data ?? []).map((c) => [c.contractId, c]));
    const reservationById = Object.fromEntries((reservations.data ?? []).map((r) => [r.reservationId, r]));

    const rows = (payments.data ?? []).map((p) => {
        const inv = invoiceById[p.invoiceId];
        const contract = inv?.contractId ? contractById[inv.contractId] : null;
        const reservation = inv?.reservationId
            ? reservationById[inv.reservationId]
            : (contract?.reservationId ? reservationById[contract.reservationId] : null);

        const { idText, kindLabel, isBooking } = classifyPaymentId(inv, reservationById, contractById);
        const unitCode = contract?.unitCode || reservation?.unitCode || '—';
        const customerName = contract?.customerName || reservation?.customerName || `Customer #${p.customerId}`;
        const isManual = p.method === 'Cash' || Boolean(p.receivedByName);
        const sourceBadge = isManual ? 'MANUAL' : 'AUTO';
        const timeStr = formatVietnamTime(p.paidAt);
        const dateStr = p.paidAt ? formatDate(p.paidAt) : (inv?.issueDate ? formatDate(inv.issueDate) : '—');

        return {
            ...p,
            timeStr,
            dateStr,
            idText,
            kindLabel,
            isBooking,
            unitCode,
            customerName,
            sourceBadge,
            invoiceNumber: inv?.invoiceNumber ?? p.invoiceNumber,
        };
    });

    const filtered = rows.filter((r) => {
        if (kindFilter === 'BOOKING' && !r.isBooking) return false;
        if (kindFilter === 'MONTHLY' && r.isBooking) return false;
        if (sourceFilter && r.sourceBadge !== sourceFilter) return false;
        return matches(search, r.idText, r.invoiceNumber, r.unitCode, r.customerName, r.paymentCode, r.referenceNo);
    });

    const openInvoices = (invoices.data ?? []).filter((i) => i.status === 'Issued' || i.status === 'Overdue');

    const simulateTransfer = useMutation({
        mutationFn: async () => {
            const amt = Number(simAmount) || 0;
            const desc = simDesc.trim();
            // 1. Send to Rust PaymentReceiver MockBankFeed if running
            const rustRes = await fetch(`${RUST_PAYMENT_API}/demo/simulate-transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount_vnd: amt, description: desc }),
            })
                .then((r) => r.json())
                .catch(() => null);

            // 2. Also match open invoice in StorEase API so the demo table updates immediately
            const normDesc = desc.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            const matchedInv = openInvoices.find((inv) => {
                const rawCode = String(inv.invoiceNumber ?? '').replace(/^DEP/, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                return rawCode && normDesc.includes(rawCode) && Math.round(inv.outstandingAmount) === amt;
            });
            if (matchedInv) {
                const intent = await invoicesApi.paymentsOnline(matchedInv.invoiceId, {
                    amount: matchedInv.outstandingAmount,
                    referenceNo: `VIETQR ${desc}`.slice(0, 50),
                });
                await paymentsApi.simulateSuccess(intent.paymentCode);
            }
            return { rustRes, matchedInvoiceNumber: matchedInv?.invoiceNumber ?? null };
        },
        onSuccess: (res) => {
            setSimResult(res);
            ['payments', 'invoices', 'reservations', 'contracts'].forEach((k) =>
                queryClient.invalidateQueries({ queryKey: [k] }),
            );
        },
    });

    const recordManual = useMutation({
        mutationFn: async () => {
            const invId = Number(manualInvoiceId);
            const amt = Number(manualAmount);
            const refText = `MANUAL:${manualBankRef.trim()} | ${manualReason.trim()} | ${manualEvidence.trim()}`.slice(0, 50);
            return invoicesApi.paymentsManual(invId, { amount: amt, referenceNo: refText });
        },
        onSuccess: () => {
            setManualModalOpen(false);
            setManualBankRef('');
            setManualReason('');
            setManualEvidence('');
            ['payments', 'invoices', 'reservations', 'contracts'].forEach((k) =>
                queryClient.invalidateQueries({ queryKey: [k] }),
            );
        },
    });

    return (
        <>
            <PageHeader
                title={tr('Payment History')}
                subtitle={tr('VietQR bank transfers and manual payment records ({bank} · {acc} · {holder})', {
                    bank: DEMO_RECEIVER_BANK.bankName,
                    acc: DEMO_RECEIVER_BANK.accountDisplay,
                    holder: DEMO_RECEIVER_BANK.accountName,
                })}
            >
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button type="button" className="se-btn se-btn-outline" onClick={() => { setSimResult(null); setSimModalOpen(true); }}>
                        {tr('Simulate VietQR transfer')}
                    </button>
                    {canRecordManual && (
                        <button
                            type="button"
                            className="se-btn se-btn-primary"
                            onClick={() => {
                                const first = openInvoices[0];
                                setManualInvoiceId(first ? String(first.invoiceId) : '');
                                setManualAmount(first ? String(first.outstandingAmount) : '');
                                setManualModalOpen(true);
                            }}
                        >
                            {tr('Manual payment entry')}
                        </button>
                    )}
                </div>
            </PageHeader>

            <div className="sa-stats">
                <Stat
                    icon="check"
                    label="Total payments"
                    value={rows.length}
                    note={formatVnd(rows.filter((r) => r.status === 'Succeeded').reduce((s, r) => s + (r.amount ?? 0), 0))}
                />
                <Stat
                    icon="calendar"
                    label="Booking payments"
                    value={rows.filter((r) => r.isBooking).length}
                />
                <Stat
                    icon="card"
                    label="Monthly payments"
                    value={rows.filter((r) => !r.isBooking).length}
                />
                <Stat
                    icon="shield"
                    tone="warn"
                    label="Manual entries"
                    value={rows.filter((r) => r.sourceBadge === 'MANUAL').length}
                />
            </div>

            <Filters>
                <SearchFilter value={search} onChange={setSearch} placeholder={tr('Search ID, unit, customer or reference')} />
                <SelectFilter
                    label="Type"
                    value={kindFilter}
                    onChange={setKindFilter}
                    all="All types"
                    options={[
                        { value: 'BOOKING', label: tr('Booking') },
                        { value: 'MONTHLY', label: tr('Monthly Payment') },
                    ]}
                />
                <SelectFilter
                    label="Source"
                    value={sourceFilter}
                    onChange={setSourceFilter}
                    all="All sources"
                    options={[
                        { value: 'AUTO', label: 'AUTO (VietQR)' },
                        { value: 'MANUAL', label: 'MANUAL' },
                    ]}
                />
            </Filters>

            <div className="se-card se-table-wrap">
                <table className="se-table sa-table">
                    <thead>
                        <tr>
                            <th>{tr('Time')}</th>
                            <th>{tr('Date')}</th>
                            <th>{tr('ID (Booking/Monthly Payment)')}</th>
                            <th>{tr('Unit')}</th>
                            <th>{tr('Customer')}</th>
                            <th>{tr('Amount')}</th>
                            <th>{tr('Source')}</th>
                            <th>{tr('Status')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((r) => (
                            <tr key={r.paymentId}>
                                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.timeStr}</td>
                                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.dateStr}</td>
                                <td>
                                    <strong className="strong">{r.idText}</strong>
                                    <div className="sa-muted">
                                        {tr(r.kindLabel)}
                                        {r.referenceNo ? ` · ${r.referenceNo}` : ''}
                                    </div>
                                </td>
                                <td><strong>{r.unitCode}</strong></td>
                                <td>{r.customerName}</td>
                                <td className="price">{formatVnd(r.amount)}</td>
                                <td>
                                    <span className={`se-badge ${r.sourceBadge === 'MANUAL' ? 'low' : ''}`}>
                                        {r.sourceBadge}
                                    </span>
                                </td>
                                <td><Status value={r.status} /></td>
                            </tr>
                        ))}
                        <TableState query={payments} rows={filtered} cols={8} empty={tr('No payment records found.')} />
                    </tbody>
                </table>
            </div>

            {simModalOpen && (
                <Modal narrow onClose={() => setSimModalOpen(false)}>
                    <form
                        className="se-panel sa-side-panel"
                        onSubmit={(e) => {
                            e.preventDefault();
                            simulateTransfer.mutate();
                        }}
                    >
                        <div className="sa-card-title">
                            <h2>{tr('Simulate incoming VietQR transfer')}</h2>
                            <button type="button" className="sa-close" onClick={() => setSimModalOpen(false)} aria-label={tr('Close')}>×</button>
                        </div>
                        <p className="sa-muted">
                            {tr('Receiving account:')} <strong>{DEMO_RECEIVER_BANK.bankName} · {DEMO_RECEIVER_BANK.accountDisplay} ({DEMO_RECEIVER_BANK.accountName})</strong>
                        </p>
                        {openInvoices.length > 0 && (
                            <label>
                                <span className="se-label">{tr('Quick-fill from an unpaid invoice')}</span>
                                <div className="se-field">
                                    <select
                                        defaultValue=""
                                        onChange={(e) => {
                                            const inv = invoiceById[Number(e.target.value)];
                                            if (!inv) return;
                                            const isDep = String(inv.invoiceNumber ?? '').startsWith('DEP');
                                            const subj = String(inv.invoiceNumber ?? '').replace(/^DEP/, '');
                                            setSimAmount(String(Math.round(inv.outstandingAmount)));
                                            setSimDesc(buildVietQrReference(subj, isDep ? 'PAY' : 'RENT', 23));
                                        }}
                                    >
                                        <option value="">{tr('— Choose an open invoice —')}</option>
                                        {openInvoices.map((inv) => (
                                            <option key={inv.invoiceId} value={inv.invoiceId}>
                                                {inv.invoiceNumber} · {formatVnd(inv.outstandingAmount)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </label>
                        )}
                        <label>
                            <span className="se-label">{tr('Transfer amount (VND) *')}</span>
                            <div className="se-input">
                                <input type="number" min="1" value={simAmount} onChange={(e) => setSimAmount(e.target.value)} required />
                            </div>
                        </label>
                        <label>
                            <span className="se-label">{tr('Bank transfer description (reference) *')}</span>
                            <div className="se-input">
                                <input maxLength={120} value={simDesc} onChange={(e) => setSimDesc(e.target.value)} required />
                            </div>
                        </label>
                        {simResult && (
                            <div className="se-alert info" role="status">
                                {simResult.matchedInvoiceNumber
                                    ? tr('Matched and confirmed invoice {num}.', { num: simResult.matchedInvoiceNumber })
                                    : tr('Transfer sent to MockBankFeed reconciliation engine.')}
                            </div>
                        )}
                        {simulateTransfer.isError && <div className="se-alert" role="alert">{errorMessage(simulateTransfer.error)}</div>}
                        <button type="submit" className="se-btn se-btn-primary se-btn-block" disabled={simulateTransfer.isPending}>
                            {simulateTransfer.isPending ? tr('Simulating…') : tr('Send simulated transfer')}
                        </button>
                    </form>
                </Modal>
            )}

            {manualModalOpen && canRecordManual && (
                <Modal narrow onClose={() => setManualModalOpen(false)}>
                    <form
                        className="se-panel sa-side-panel"
                        onSubmit={(e) => {
                            e.preventDefault();
                            recordManual.mutate();
                        }}
                    >
                        <div className="sa-card-title">
                            <h2>{tr('Manual payment entry')} <span className="se-badge low">MANUAL</span></h2>
                            <button type="button" className="sa-close" onClick={() => setManualModalOpen(false)} aria-label={tr('Close')}>×</button>
                        </div>
                        <p className="sa-muted">{tr('Fallback when automatic feed is down. Restricted to Finance/Ops, Facility Manager, and Admin.')}</p>
                        <label>
                            <span className="se-label">{tr('Open invoice *')}</span>
                            <div className="se-field">
                                <select
                                    value={manualInvoiceId}
                                    onChange={(e) => {
                                        setManualInvoiceId(e.target.value);
                                        const inv = invoiceById[Number(e.target.value)];
                                        if (inv) setManualAmount(String(inv.outstandingAmount));
                                    }}
                                    required
                                >
                                    <option value="">{tr('— Select open invoice —')}</option>
                                    {openInvoices.map((inv) => (
                                        <option key={inv.invoiceId} value={inv.invoiceId}>
                                            {inv.invoiceNumber} · {formatVnd(inv.outstandingAmount)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </label>
                        <label>
                            <span className="se-label">{tr('Amount (VND) *')}</span>
                            <div className="se-input">
                                <input type="number" min="1" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} required />
                            </div>
                        </label>
                        <label>
                            <span className="se-label">{tr('Bank transaction ID / Reference code *')}</span>
                            <div className="se-input">
                                <input maxLength={40} value={manualBankRef} onChange={(e) => setManualBankRef(e.target.value)} placeholder="e.g. FT26112800912" required />
                            </div>
                        </label>
                        <label>
                            <span className="se-label">{tr('Reason *')}</span>
                            <div className="se-input">
                                <input maxLength={120} value={manualReason} onChange={(e) => setManualReason(e.target.value)} placeholder={tr('e.g. Customer omitted reference code in transfer')} required />
                            </div>
                        </label>
                        <label>
                            <span className="se-label">{tr('Evidence (receipt file name / note) *')}</span>
                            <div className="se-input">
                                <input maxLength={120} value={manualEvidence} onChange={(e) => setManualEvidence(e.target.value)} placeholder={tr('e.g. tpbank_screenshot_0285636.png')} required />
                            </div>
                        </label>
                        {recordManual.isError && <div className="se-alert" role="alert">{errorMessage(recordManual.error)}</div>}
                        <button
                            type="submit"
                            className="se-btn se-btn-primary se-btn-block"
                            disabled={
                                recordManual.isPending
                                || !manualInvoiceId
                                || !Number(manualAmount)
                                || !manualBankRef.trim()
                                || !manualReason.trim()
                                || !manualEvidence.trim()
                            }
                        >
                            {recordManual.isPending ? tr('Recording…') : tr('Record manual payment')}
                        </button>
                    </form>
                </Modal>
            )}
        </>
    );
}
