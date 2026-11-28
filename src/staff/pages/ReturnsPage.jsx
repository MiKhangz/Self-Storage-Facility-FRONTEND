import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { depositRefundsApi, handoversApi, returnsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { useAuth } from '../../features/auth/AuthContext';
import { Roles } from '../../features/auth/roles';
import Icon from '../../customer/components/Icon.jsx';
import { formatDate, formatVnd } from '../../customer/components/format.js';
import { formatDateTime } from '../../customer/support/support.js';
import HandoverPhotos from '../components/HandoverPhotos.jsx';
import { Modal, PageHeader, Stat, Status, TableState } from '../components/ui.jsx';
import { fetchAll, humanize, useReturns } from '../queries.js';
import { useT } from '../../i18n/I18n.jsx';
import { confirmAction } from '../../customer/components/confirm.js';

const TABS = ['Requested', 'Approved', 'Inspected', 'AwaitingPayout', 'Completed', 'Cancelled'];

const CONDITION_CARDS = [
    {
        value: 'Good',
        label: 'Good',
        tone: 'good',
        icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
        ),
    },
    {
        value: 'MinorDamage',
        label: 'Minor damage',
        tone: 'minor',
        icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" x2="12" y1="8" y2="12" />
                <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
        ),
    },
    {
        value: 'MajorDamage',
        label: 'Major damage',
        tone: 'severe',
        icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" x2="12" y1="9" y2="13" />
                <line x1="12" x2="12.01" y1="17" y2="17" />
            </svg>
        ),
    },
];

const FEE_FIELDS = [
    { key: 'cleaningFee', label: 'Cleaning fee' },
    { key: 'repairCharge', label: 'Repair charge' },
    { key: 'otherDeduction', label: 'Other deduction' },
];

const formatNumVnd = (n) => new Intl.NumberFormat('vi-VN').format(Number(n) || 0);
const parseNumVnd = (str) => {
    const digits = String(str ?? '').replace(/\D/g, '');
    return digits ? Math.min(parseInt(digits, 10), 999_999_999) : 0;
};

/** 09:00 on the planned day, or the next full hour when that has already passed (a same-day return). */
function firstSlot(plannedDate) {
    const nine = new Date(`${plannedDate}T09:00`);
    if (nine > new Date()) return `${plannedDate}T09:00`;
    const next = new Date();
    next.setHours(next.getHours() + 1, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:00`;
}

/** Extract time (e.g. "08:30") from inspectionSlot or reason ("Giờ hẹn: 08:30"). */
function extractReturnTime(request) {
    if (request.inspectionSlot) {
        const dt = formatDateTime(request.inspectionSlot);
        const match = dt.match(/\b(\d{2}:\d{2})\b/);
        if (match) return match[1];
    }
    const reasonMatch = (request.reason ?? '').match(/\b(\d{2}:\d{2})\b/);
    return reasonMatch ? reasonMatch[1] : null;
}

/** Parse bank name, account number, and holder from refundAccount string ("TPBank 0333333333 KHACH DEMO"). */
function parseRefundAccount(refundAccount = '') {
    const trimmed = refundAccount.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(\S+)\s+(\d[\d\s]*)\s*(.*)$/);
    if (!match) return { bank: trimmed, account: '', holder: '' };
    return {
        bank: match[1],
        account: match[2].trim(),
        holder: match[3].trim(),
    };
}

function Approve({ request, onDone }) {
    const tr = useT();
    const [slot, setSlot] = useState(() => firstSlot(request.plannedReturnDate));
    const approve = useMutation({ mutationFn: () => returnsApi.approve(request.unitReturnId, { inspectionSlot: slot }), onSuccess: onDone });
    return (
        <div className="sa-ret-action-section">
            <label>
                <span className="se-label">{tr('Inspection appointment')}</span>
                <div className="se-input"><input type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)} /></div>
            </label>
            {approve.isError && <div className="se-alert" role="alert">{errorMessage(approve.error)}</div>}
            <button type="button" className="se-btn se-btn-primary se-btn-block sa-ret-submit-btn" disabled={!slot || approve.isPending} onClick={() => approve.mutate()}>
                {tr('Approve & book inspection')}
            </button>
        </div>
    );
}

function Inspect({ request, onDone }) {
    const tr = useT();
    const [form, setForm] = useState({ conditionResult: 'Good', cleaningFee: 0, repairCharge: 0, otherDeduction: 0 });
    const [damageNote, setDamageNote] = useState('');
    const [feesExpanded, setFeesExpanded] = useState(false);
    const [activeFeeKey, setActiveFeeKey] = useState('cleaningFee');
    const [focusedKey, setFocusedKey] = useState(null);

    const inspect = useMutation({
        mutationFn: () => returnsApi.inspection(request.unitReturnId, form),
        onSuccess: onDone,
    });

    const isDamaged = form.conditionResult !== 'Good';
    const totalFees = form.cleaningFee + form.repairCharge + form.otherDeduction;
    const showFeesPanel = feesExpanded || isDamaged || totalFees > 0;

    const selectCondition = (conditionResult) => {
        setForm((prev) => ({ ...prev, conditionResult }));
        if (conditionResult !== 'Good') {
            setFeesExpanded(true);
            setActiveFeeKey('repairCharge');
        } else if (totalFees === 0) {
            setFeesExpanded(false);
        }
    };

    const collapseFees = () => {
        setForm((prev) => ({ ...prev, cleaningFee: 0, repairCharge: 0, otherDeduction: 0 }));
        setFeesExpanded(false);
    };

    const setFeeValue = (key, raw) => {
        const val = parseNumVnd(raw);
        setForm((prev) => ({ ...prev, [key]: val }));
    };

    const quickAdd = (amount) => {
        setForm((prev) => ({
            ...prev,
            [activeFeeKey]: Math.min((prev[activeFeeKey] || 0) + amount, 999_999_999),
        }));
    };

    const activeFeeLabel = FEE_FIELDS.find((f) => f.key === activeFeeKey)?.label ?? 'Cleaning fee';

    return (
        <>
            <div className="sa-ret-divider">
                <span>{tr('Inspection results')}</span>
            </div>

            <div className="sa-ret-inspect-body">
                <div>
                    <span className="se-label">{tr('Unit condition')}</span>
                    <div className="sa-ret-cond-grid" role="radiogroup" aria-label={tr('Unit condition')}>
                        {CONDITION_CARDS.map((c) => {
                            const active = form.conditionResult === c.value;
                            return (
                                <button
                                    key={c.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={active}
                                    className={`sa-ret-cond-card ${c.tone}${active ? ' active' : ''}`}
                                    onClick={() => selectCondition(c.value)}
                                >
                                    <span className="sa-ret-cond-icon">{c.icon}</span>
                                    <span className="sa-ret-cond-label">{tr(c.label)}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {isDamaged && (
                    <div className="sa-ret-damage-note">
                        <div className="sa-ret-label-row">
                            <span>{tr('Damage note')}</span>
                            <small>{tr('Optional')}</small>
                        </div>
                        <textarea
                            rows={2}
                            className="se-textarea"
                            value={damageNote}
                            onChange={(e) => setDamageNote(e.target.value)}
                            placeholder={tr('Short description of scratches, broken lock, dampness...')}
                        />
                    </div>
                )}

                {!showFeesPanel ? (
                    <div className="sa-ret-fees-collapsed">
                        <div className="sa-ret-fees-zero">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <path d="m9 12 2 2 4-4" />
                            </svg>
                            <span>{tr('No deduction fees')} <strong>(0 ₫)</strong></span>
                        </div>
                        <button type="button" className="sa-ret-add-fee-btn" onClick={() => setFeesExpanded(true)}>
                            {tr('+ Add surcharge')}
                        </button>
                    </div>
                ) : (
                    <div className="sa-ret-fees-panel">
                        <div className="sa-ret-fees-head">
                            <strong>{tr('Deduction fees')}</strong>
                            {!isDamaged && (
                                <button type="button" className="sa-ret-collapse-btn" onClick={collapseFees}>
                                    {tr('Collapse (0 ₫)')}
                                </button>
                            )}
                        </div>

                        {FEE_FIELDS.map(({ key, label }) => {
                            const val = form[key];
                            const highlightRepair = key === 'repairCharge' && isDamaged;
                            const displayVal = focusedKey === key && val === 0 ? '' : formatNumVnd(val);
                            return (
                                <div key={key} className={`sa-ret-fee-row${highlightRepair ? ' highlight' : ''}`}>
                                    <label className="sa-ret-label-row" htmlFor={`fee-${key}`}>
                                        <span>{tr(label)}</span>
                                        {highlightRepair && <span className="sa-ret-suggest-badge">{tr('Suggested')}</span>}
                                    </label>
                                    <div className="sa-ret-fee-input-wrap">
                                        {val > 0 && (
                                            <button
                                                type="button"
                                                className="sa-ret-fee-clear"
                                                aria-label={tr('Clear')}
                                                onClick={() => setForm((prev) => ({ ...prev, [key]: 0 }))}
                                            >
                                                ×
                                            </button>
                                        )}
                                        <input
                                            id={`fee-${key}`}
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            value={displayVal}
                                            onFocus={() => { setActiveFeeKey(key); setFocusedKey(key); }}
                                            onBlur={() => setFocusedKey(null)}
                                            onChange={(e) => setFeeValue(key, e.target.value)}
                                        />
                                        <span className="sa-ret-fee-unit">VNĐ</span>
                                    </div>
                                </div>
                            );
                        })}

                        <div className="sa-ret-quick-row">
                            <span className="sa-ret-quick-label">
                                {tr('Quick add to')} <strong>{tr(activeFeeLabel)}</strong>:
                            </span>
                            <div className="sa-ret-quick-chips">
                                {[
                                    [50_000, '+50k'],
                                    [100_000, '+100k'],
                                    [500_000, '+500k'],
                                ].map(([amt, text]) => (
                                    <button
                                        key={text}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => quickAdd(amt)}
                                    >
                                        {text}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {inspect.isError && <div className="se-alert" role="alert">{errorMessage(inspect.error)}</div>}
            </div>

            <div className="sa-ret-footer">
                <div className="sa-ret-total-row">
                    <span>{tr('Total deductions')}</span>
                    <strong className={totalFees > 0 ? 'has-fee' : ''}>{formatNumVnd(totalFees)} ₫</strong>
                </div>
                <button
                    type="button"
                    className="se-btn se-btn-primary se-btn-block sa-ret-submit-btn"
                    disabled={inspect.isPending}
                    onClick={() => inspect.mutate()}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                    </svg>
                    {inspect.isPending ? tr('Saving…') : tr('Save inspection')}
                </button>
            </div>
        </>
    );
}

function Settle({ request, onDone }) {
    const tr = useT();
    // Refresh only when they close the result: refetching makes the request Completed, which would unmount this
    // breakdown (refund and any shortfall the customer still owes) before anyone reads it.
    const settle = useMutation({ mutationFn: () => returnsApi.settleDeposit(request.unitReturnId) });
    const s = settle.data;
    return (
        <div className="sa-ret-action-section">
            {s && (
                <dl className="se-kv">
                    <div><dt>{tr('Deposit')}</dt><dd>{formatVnd(s.depositAmount)}</dd></div>
                    <div><dt>{tr('Damage deductions')}</dt><dd>− {formatVnd(s.damageDeductions)}</dd></div>
                    {s.earlyTerminationPenalty > 0 && <div><dt>{tr('Early return penalty')}</dt><dd>− {formatVnd(s.earlyTerminationPenalty)}</dd></div>}
                    <div><dt>{tr('Outstanding invoices')}</dt><dd>− {formatVnd(s.outstandingInvoices)}</dd></div>
                    <div><dt><strong>{tr('Refund')}</strong></dt><dd>{formatVnd(s.refundAmount)}</dd></div>
                    {s.shortfall > 0 && <div><dt>{tr('Customer still owes')}</dt><dd className="sa-bad">{formatVnd(s.shortfall)}</dd></div>}
                    {s.shortfallInvoiceNumber && <div><dt>{tr('Shortfall invoice')}</dt><dd><strong>{s.shortfallInvoiceNumber}</strong></dd></div>}
                </dl>
            )}
            {s?.refundAmount > 0 && <p className="se-hint">{tr('The refund is now waiting in Deposit Refunds until it is paid.')}</p>}
            {s?.shortfallInvoiceNumber && (
                <p className="se-hint">
                    {tr('Shortfall invoice {number} ({amount}) has been issued to the customer.', {
                        number: s.shortfallInvoiceNumber,
                        amount: formatVnd(s.shortfall),
                    })}
                </p>
            )}
            {s && <button type="button" className="se-btn se-btn-primary se-btn-block sa-ret-submit-btn" onClick={onDone}>{tr('Done')}</button>}
            {settle.isError && <div className="se-alert" role="alert">{errorMessage(settle.error)}</div>}
            {!s && (
                <button
                    type="button"
                    className="se-btn se-btn-primary se-btn-block sa-ret-submit-btn"
                    disabled={settle.isPending}
                    onClick={() => confirmAction(tr('Settle the deposit? This closes the contract and frees the unit.')).then((ok) => ok && settle.mutate())}
                >
                    {tr('Settle deposit & close')}
                </button>
            )}
        </div>
    );
}

function ReturnModal({ current, handedOver, isStaff, role, onClose, onDone }) {
    const tr = useT();
    const [copied, setCopied] = useState(false);
    const [metaOpen, setMetaOpen] = useState(false);

    const copyContract = () => {
        try {
            navigator.clipboard?.writeText(current.contractNumber);
        } catch {
            // fallback ignored
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    const returnTime = extractReturnTime(current);
    const parsedBank = parseRefundAccount(current.refundAccount);
    const shortMoveOut = current.moveOutDeadline ? formatDate(current.moveOutDeadline).slice(0, 5) : '—';
    const shortHandoverDate = handedOver?.handoverTime ? formatDate(handedOver.handoverTime).slice(0, 5) : null;
    const maskedBankPreview = parsedBank
        ? `${parsedBank.bank}${parsedBank.account ? ` •••${parsedBank.account.slice(-3)}` : ''}`
        : tr(humanize(current.refundMethod));

    return (
        <Modal narrow onClose={onClose}>
            <aside className="se-panel sa-return-modal">
                {/* 1. HEADER */}
                <div className="sa-ret-header">
                    <div className="sa-ret-header-main">
                        <div className="sa-ret-title-row">
                            <h2>{tr('Unit')} {current.unitCode}</h2>
                            <Status value={current.status} />
                        </div>
                        <div className="sa-ret-sub-row">
                            <span className="sa-ret-customer">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                                {current.customerName}
                            </span>
                            <span className="sa-ret-dot">•</span>
                            <button
                                type="button"
                                className={`sa-ret-copy-pill${copied ? ' copied' : ''}`}
                                onClick={copyContract}
                                title={tr('Copy contract number')}
                            >
                                {!copied ? (
                                    <>
                                        <span>{current.contractNumber}</span>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                        </svg>
                                    </>
                                ) : (
                                    <>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        <span>{tr('Copied')}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    <button type="button" className="sa-close" onClick={onClose} aria-label={tr('Close')}>
                        <Icon name="close" size={16} />
                    </button>
                </div>

                {/* 2. BODY */}
                <div className="sa-ret-body">
                    {/* 2-Column Context Strip */}
                    <div className="sa-ret-ctx-grid">
                        <div className="sa-ret-ctx-card">
                            <div className="sa-ret-ctx-head">
                                <Icon name="calendar" size={14} />
                                <span>{tr('Return schedule')}</span>
                            </div>
                            <p className="sa-ret-ctx-val">
                                {formatDate(current.plannedReturnDate)}
                                {returnTime && (
                                    <>
                                        <span className="sa-ret-sep">·</span>
                                        <strong className="sa-ret-time">{returnTime}</strong>
                                    </>
                                )}
                            </p>
                        </div>

                        <div className="sa-ret-ctx-card">
                            <div className="sa-ret-ctx-head muted">
                                <Icon name="file" size={14} />
                                <span>{shortHandoverDate ? `${tr('At handover')} (${shortHandoverDate})` : tr('Condition at handover')}</span>
                            </div>
                            <p className="sa-ret-ctx-val muted">
                                {handedOver?.conditionNote || tr('No note taken')}
                            </p>
                        </div>
                    </div>

                    {/* 3. Collapsible Low-Priority Metadata */}
                    <div className="sa-ret-meta-accordion">
                        <button
                            type="button"
                            className="sa-ret-meta-toggle"
                            aria-expanded={metaOpen}
                            onClick={() => setMetaOpen((o) => !o)}
                        >
                            <div className="sa-ret-meta-toggle-left">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 16v-4" />
                                    <path d="M12 8h.01" />
                                </svg>
                                <div>
                                    <strong>{tr('Request & refund details')}</strong>
                                    {!metaOpen && (
                                        <small>
                                            {maskedBankPreview} · {tr('Move out by')} {shortMoveOut}
                                        </small>
                                    )}
                                </div>
                            </div>
                            <span className={`sa-ret-chev${metaOpen ? ' open' : ''}`}>
                                <Icon name="down" size={15} />
                            </span>
                        </button>

                        {metaOpen && (
                            <div className="sa-ret-meta-body">
                                <div className="sa-ret-meta-row">
                                    <span>{tr('Requested')}</span>
                                    <strong>{formatDateTime(current.requestedAt)}</strong>
                                </div>
                                <div className="sa-ret-meta-row">
                                    <span>{tr('Move out by')}</span>
                                    <strong>{formatDate(current.moveOutDeadline)}</strong>
                                </div>
                                {current.reason && (
                                    <div className="sa-ret-meta-row">
                                        <span>{tr('Reason')}</span>
                                        <strong>{current.reason}</strong>
                                    </div>
                                )}
                                <div className="sa-ret-meta-bank">
                                    <span className="sa-ret-meta-bank-label">{tr('Refund to')}</span>
                                    <div className="sa-ret-meta-bank-box">
                                        <div>
                                            <strong>
                                                {parsedBank ? (
                                                    <>
                                                        {parsedBank.bank}
                                                        {parsedBank.account && <> · <code>{parsedBank.account}</code></>}
                                                    </>
                                                ) : (
                                                    tr(humanize(current.refundMethod))
                                                )}
                                            </strong>
                                            <small>
                                                {tr(humanize(current.refundMethod))}
                                                {parsedBank?.holder ? ` · ${parsedBank.holder}` : ''}
                                            </small>
                                        </div>
                                        <span className="sa-ret-bank-tag">
                                            {current.refundMethod === 'BankTransfer' ? 'CK' : tr('Cash')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {handedOver && <HandoverPhotos handover={handedOver} />}

                    {current.inspection && (
                        <div className="sa-ret-ctx-card">
                            <div className="sa-ret-ctx-head">
                                <Icon name="check" size={14} />
                                <span>{tr('Inspection')}</span>
                            </div>
                            <p className="sa-ret-ctx-val">
                                {tr(humanize(current.inspection.conditionResult))} · {tr('Refund')} {formatVnd(current.inspection.refundAmount)}
                            </p>
                        </div>
                    )}

                    {current.accessLockedAt && (
                        <div className="se-alert" role="alert">
                            Past the move-out deadline: access was locked on {formatDateTime(current.accessLockedAt)}. Clear the unit out, then inspect it.
                        </div>
                    )}

                    {current.status === 'Requested' && isStaff && <Approve request={current} onDone={onDone} />}
                    {current.status === 'Approved' && isStaff && <Inspect request={current} onDone={onDone} />}
                    {current.status === 'Inspected' && role === Roles.BusinessOperationsManager && <Settle request={current} onDone={onDone} />}
                    {current.status === 'Inspected' && role !== Roles.BusinessOperationsManager && (
                        <p className="sa-muted">{tr('A Business Operations Manager settles the deposit.')}</p>
                    )}
                    {current.status === 'AwaitingPayout' && (
                        <p className="se-hint">{tr('The refund is now waiting in Deposit Refunds until it is paid.')}</p>
                    )}
                </div>
            </aside>
        </Modal>
    );
}

/** A15: approve returns, inspect returned units and settle deposits. */
export default function ReturnsPage() {
    const tr = useT();
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState('Requested');
    const [selected, setSelected] = useState(null);
    const returns = useReturns();
    const pendingRefunds = useQuery({
        queryKey: ['deposit-refunds', 'Pending'],
        queryFn: () => fetchAll(depositRefundsApi.list, { status: 'Pending' }),
    });
    const pendingReturnIds = new Set(
        (pendingRefunds.data ?? []).filter((r) => r.unitReturnId != null && r.status === 'Pending').map((r) => r.unitReturnId),
    );
    const all = (returns.data ?? []).map((m) =>
        m.status === 'Completed' && pendingReturnIds.has(m.unitReturnId) ? { ...m, status: 'AwaitingPayout' } : m,
    );
    const shown = all.filter((m) => m.status === tab);
    const current = all.find((m) => m.unitReturnId === selected);
    // What staff noted when the unit was handed over, to compare with how it comes back.
    const handovers = useQuery({ queryKey: ['handovers', 'Completed'], queryFn: () => handoversApi.list({ status: 'Completed', page: 1, pageSize: 100 }) });
    const handedOver = current && handovers.data?.items?.find((h) => h.contractId === current.contractId);
    const done = () => {
        ['returns', 'contracts', 'storage-units', 'invoices', 'deposit-refunds'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
        setSelected(null);
    };
    const isStaff = [Roles.FacilityStaff, Roles.FacilityManager].includes(session?.role);

    return (
        <>
            <PageHeader title={tr('Returns')} subtitle="Inspect returned units, settle deposits and release units" />
            <div className="se-tabs se-tabs-line" role="tablist">
                {TABS.map((t) => (
                    <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => { setTab(t); setSelected(null); }}>
                        {tr(humanize(t))} <span className="se-count">{all.filter((m) => m.status === t).length}</span>
                    </button>
                ))}
            </div>
            <div className="sa-split open">
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
                                    <td><Status value={m.status} /></td>
                                </tr>
                            ))}
                            <TableState query={returns} rows={shown} cols={7} empty="Nothing in this list." />
                        </tbody>
                    </table>
                </div>
                <div className="sa-stats-stack">
                    <Stat icon="arrowLeft" label="Return requests" value={all.filter((m) => m.status === 'Requested').length} />
                    <Stat icon="calendar" label="Inspections booked" value={all.filter((m) => m.status === 'Approved').length} />
                    <Stat icon="card" tone="warn" label="Awaiting settlement" value={all.filter((m) => m.status === 'Inspected').length} />
                    <Stat icon="clock" tone="warn" label="Awaiting payout" value={all.filter((m) => m.status === 'AwaitingPayout').length} />
                    <Stat icon="check" label="Completed" value={all.filter((m) => m.status === 'Completed').length} />
                </div>
                {current && (
                    <ReturnModal
                        key={current.unitReturnId}
                        current={current}
                        handedOver={handedOver}
                        isStaff={isStaff}
                        role={session?.role}
                        onClose={() => setSelected(null)}
                        onDone={done}
                    />
                )}
            </div>
        </>
    );
}
