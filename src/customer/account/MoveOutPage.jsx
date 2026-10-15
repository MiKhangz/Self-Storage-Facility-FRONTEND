import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { moveOutRequestsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import { addDays, formatDate, formatVnd, todayIso } from '../components/format.js';
import { useTerms } from '../components/terms.js';
import { useMyContracts, useMyReservations } from './queries.js';
import './UnitDetailPage.css';

const CHECKS = [
    'The unit will be completely empty and swept',
    'I will remove my own disc lock and bring the access card',
    'I understand cleaning or repair costs are deducted from the deposit',
    'I will be there in person, or send someone with written authorisation',
];
const NEXT_STEPS = [
    'We confirm your request and the inspection time.',
    'You empty the unit and remove your lock before the appointment.',
    'Staff inspect the unit with you and take back the lock and card.',
    'The deposit, minus any charges, is refunded within 7 days.',
];
const MOVE_OUT_BADGE = { Requested: 'low', Approved: 'low', Inspected: 'low', Completed: '', Cancelled: 'none' };

/** U15: ask to end a rental — date, checklist and where to refund the deposit. */
export default function MoveOutPage() {
    const [params] = useSearchParams();
    const queryClient = useQueryClient();
    const contracts = useMyContracts();
    const reservations = useMyReservations();
    const requests = useQuery({ queryKey: ['move-outs'], queryFn: () => moveOutRequestsApi.list({ page: 1, pageSize: 50 }) });

    const active = (contracts.data?.items ?? []).filter((c) => c.status === 'Active');
    const [picked, setPicked] = useState('');
    const contract = active.find((c) => c.contractId === (Number(picked) || Number(params.get('contractId')))) ?? active[0];
    const reservation = reservations.data?.items?.find((r) => r.reservationId === contract?.reservationId);
    const open = requests.data?.items?.find((m) => m.contractId === contract?.contractId && m.status !== 'Cancelled');

    const terms = useTerms();
    // The API refuses dates inside the notice period, so don't offer them.
    const earliest = addDays(todayIso(), terms.data?.noticeDays ?? 0);
    const [form, setForm] = useState({ plannedMoveOutDate: '', reason: '', refundMethod: 'BankTransfer', refundAccount: '' });
    const [checked, setChecked] = useState(CHECKS.map(() => false));
    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    const needsAccount = form.refundMethod === 'BankTransfer';
    const ready = form.plannedMoveOutDate && checked.every(Boolean) && (!needsAccount || form.refundAccount.trim());

    const submit = useMutation({
        mutationFn: () => moveOutRequestsApi.create({
            contractId: contract.contractId,
            plannedMoveOutDate: form.plannedMoveOutDate,
            reason: form.reason.trim() || null,
            refundMethod: form.refundMethod,
            refundAccount: needsAccount ? form.refundAccount.trim() : null,
        }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['move-outs'] }),
    });

    if (contracts.isLoading) return <p className="se-empty">Loading…</p>;
    if (!contract) {
        return (
            <>
                <div className="se-account-title"><div><h1>Request move-out</h1></div></div>
                <div className="se-card se-empty">You have no active rental to move out of. <Link to="/my-storage" className="se-link">Back to My units</Link></div>
            </>
        );
    }

    return (
        <>
            <Link to={`/my-storage/units/${contract.contractId}`} className="se-back"><Icon name="arrowLeft" size={16} /> Back to unit {contract.unitCode}</Link>
            <div className="se-account-title">
                <div><h1>Request move-out</h1><p>Tell us when you will empty the unit; staff then book an inspection with you.</p></div>
            </div>

            <div className="se-detail-grid">
                <div className="se-panel">
                    <div className="se-summary-unit">
                        <span className="se-brand-mark"><Icon name="box" size={18} /></span>
                        <div>
                            <strong>Unit {contract.unitCode}{reservation ? ` · ${reservation.unitTypeName}` : ''}</strong>
                            <small>{reservation?.facilityName} · contract {contract.contractNumber} ends {formatDate(contract.endDate)}</small>
                        </div>
                        {active.length > 1 && (
                            <select className="se-unit-switch" value={contract.contractId} onChange={(e) => setPicked(e.target.value)} aria-label="Change unit">
                                {active.map((c) => <option key={c.contractId} value={c.contractId}>{c.unitCode}</option>)}
                            </select>
                        )}
                    </div>

                    {open ? (
                        <div className="se-alert info">
                            Move-out already requested for {formatDate(open.plannedMoveOutDate)} — status{' '}
                            <span className={`se-badge ${MOVE_OUT_BADGE[open.status] ?? ''}`}>{open.status}</span>
                            {open.inspectionSlot ? ` · inspection ${formatDate(open.inspectionSlot)}` : ''}
                        </div>
                    ) : (
                        <form className="se-form" onSubmit={(e) => { e.preventDefault(); if (ready) submit.mutate(); }}>
                            <h2>1. When will you move out?</h2>
                            <div className="se-panel-grid">
                                <label><span className="se-label">Planned move-out date</span>
                                    <div className="se-field"><Icon name="calendar" />
                                        <input type="date" min={earliest} max={contract.endDate} value={form.plannedMoveOutDate} onChange={(e) => set({ plannedMoveOutDate: e.target.value })} required />
                                    </div>
                                    <p className="se-hint">{terms.data ? `${terms.data.noticeDays} days' notice: the earliest date is ${formatDate(earliest)}.` : 'Notice is required; the earliest allowed date is checked when you submit.'}</p>
                                </label>
                                <label><span className="se-label">Reason (optional)</span>
                                    <div className="se-input"><input maxLength={200} value={form.reason} onChange={(e) => set({ reason: e.target.value })} placeholder="e.g. Moving to a bigger unit" /></div>
                                </label>
                            </div>

                            <h2>2. Confirm before the inspection</h2>
                            <div className="se-checklist">
                                {CHECKS.map((label, i) => (
                                    <label key={label} className="se-check">
                                        <input type="checkbox" checked={checked[i]} onChange={(e) => setChecked(checked.map((v, j) => (j === i ? e.target.checked : v)))} />
                                        <span>{label}</span>
                                    </label>
                                ))}
                            </div>

                            <h2>3. Where should we refund the deposit?</h2>
                            <div className="se-panel-grid">
                                <label><span className="se-label">Refund method</span>
                                    <div className="se-field"><Icon name="card" />
                                        <select value={form.refundMethod} onChange={(e) => set({ refundMethod: e.target.value })}>
                                            <option value="BankTransfer">Bank transfer</option>
                                            <option value="Cash">Cash at the facility</option>
                                        </select>
                                    </div>
                                </label>
                                {needsAccount && (
                                    <label><span className="se-label">Bank and account number</span>
                                        <div className="se-input"><input maxLength={50} value={form.refundAccount} onChange={(e) => set({ refundAccount: e.target.value })} placeholder="Vietcombank 0071 000 123 456" required /></div>
                                    </label>
                                )}
                            </div>

                            {submit.isError && <div className="se-alert" role="alert">{errorMessage(submit.error)}</div>}
                            <div className="se-form-actions">
                                <Link to={`/my-storage/units/${contract.contractId}`} className="se-btn se-btn-ghost">Cancel</Link>
                                <button type="submit" className="se-btn se-btn-primary" disabled={!ready || submit.isPending}>
                                    {submit.isPending ? 'Sending…' : <>Submit move-out request <Icon name="arrow" size={16} /></>}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                <aside>
                    <section className="se-panel">
                        <h2>Deposit</h2>
                        <dl className="se-kv">
                            <div><dt>Deposit held</dt><dd>{formatVnd(contract.depositAmount)}</dd></div>
                            <div><dt>Cleaning / damage</dt><dd>assessed on the day</dd></div>
                        </dl>
                        <p className="se-hint">The final refund is confirmed after the inspection and paid within 7 days.</p>
                    </section>
                    <section className="se-panel">
                        <h2>What happens next</h2>
                        <ol className="se-next-steps">{NEXT_STEPS.map((s) => <li key={s}>{s}</li>)}</ol>
                    </section>
                    <div className="se-due-card">
                        <strong>Moving out early</strong>
                        <small>Your contract runs to {formatDate(contract.endDate)}. Moving out earlier is allowed, but the remaining months are not refunded.</small>
                    </div>
                </aside>
            </div>
        </>
    );
}
