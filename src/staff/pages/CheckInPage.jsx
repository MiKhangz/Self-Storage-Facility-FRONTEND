import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accessCodesApi, checkInsApi, contractsApi, unitVisitsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../../customer/components/Icon.jsx';
import { formatDate, rentalEndDate, todayIso } from '../../customer/components/format.js';
import { PageHeader, Stat, Status } from '../components/ui.jsx';
import { useContracts, useInvoices, useReservations, useUnits } from '../queries.js';

/** The physical checks the Figma lists before keys change hands; staff tick each one. */
const CHECKS = [
    { key: 'identity', title: 'Verify identity', text: 'Citizen ID (CCCD) matches the renter name' },
    { key: 'payment', title: 'Verify payment', text: 'The deposit is paid (check-in is refused until it is)' },
    { key: 'inspect', title: 'Inspect unit with customer', text: 'Agree the condition before handing over' },
];

function CheckInWizard({ reservation, contract, onDone }) {
    const queryClient = useQueryClient();
    const [ticks, setTicks] = useState({});
    const [form, setForm] = useState({ lockSerial: '', cardNumber: '', conditionNote: '' });
    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    // A walk-in customer may have no password yet: staff record that they signed the paper contract here.
    const signAtDesk = useMutation({
        mutationFn: () => contractsApi.signAtDesk(contract.contractId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts'] }),
    });
    const checkIn = useMutation({
        mutationFn: () => checkInsApi.create({ reservationId: reservation.reservationId, contractId: contract.contractId, ...form }),
    });
    // Refresh only after staff move on: refetching drops this reservation from the queue, which would unmount
    // the one-time access code before anyone reads it.
    const next = () => {
        ['reservations', 'contracts', 'storage-units'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
        onDone();
    };

    if (checkIn.data) {
        return (
            <div className="se-panel sa-checkin-done">
                <span className="se-confirm-icon"><Icon name="check" size={28} /></span>
                <h2>Check-in complete — unit {checkIn.data.unitCode} is now occupied</h2>
                <p className="sa-muted">Give the customer this access code. It is shown once only.</p>
                <div className="se-code-digits dark">{(checkIn.data.accessCode ?? '').split('').map((d, i) => <span key={i}>{d}</span>)}</div>
                <button type="button" className="se-btn se-btn-primary" onClick={next}>Next check-in</button>
            </div>
        );
    }

    const allTicked = CHECKS.every((c) => ticks[c.key]);
    const ready = allTicked && form.lockSerial.trim() && form.cardNumber.trim() && contract.signedAt;
    return (
        <div className="se-panel">
            <div className="sa-card-title">
                <h2>Check-in · {reservation.customerName} → Unit {reservation.unitCode}</h2>
                <span className="sa-muted">{reservation.reservationCode} · {contract.contractNumber}</span>
            </div>
            <ol className="sa-steps">
                {CHECKS.map((c) => (
                    <li key={c.key} className={ticks[c.key] ? 'done' : ''}>
                        <label className="se-check"><input type="checkbox" checked={!!ticks[c.key]} onChange={(e) => setTicks({ ...ticks, [c.key]: e.target.checked })} />
                            <span><strong>{c.title}</strong><small>{c.text}</small></span></label>
                    </li>
                ))}
                <li className={contract.signedAt ? 'done' : ''}>
                    <span><strong>Customer signs the contract</strong><small>{contract.signedAt ? `Signed ${formatDate(contract.signedAt)}` : 'The customer signs from My Storage, or on paper here at the desk'}</small></span>
                    {!contract.signedAt && (
                        <button type="button" className="se-btn se-btn-ghost se-btn-sm" disabled={signAtDesk.isPending}
                            onClick={() => window.confirm('Confirm the customer signed the paper contract in front of you?') && signAtDesk.mutate()}>
                            Customer signed on paper
                        </button>
                    )}
                    {signAtDesk.isError && <div className="se-alert" role="alert">{errorMessage(signAtDesk.error)}</div>}
                </li>
                <li>
                    <span><strong>Hand over disc lock &amp; access card</strong><small>Record the serial numbers given to the customer</small></span>
                    <div className="se-panel-grid">
                        <label><span className="se-label">Lock serial no.</span><div className="se-input"><input value={form.lockSerial} maxLength={30} onChange={(e) => set({ lockSerial: e.target.value })} /></div></label>
                        <label><span className="se-label">Access card no.</span><div className="se-input"><input value={form.cardNumber} maxLength={30} onChange={(e) => set({ cardNumber: e.target.value })} /></div></label>
                    </div>
                    <label><span className="se-label">Condition note (optional)</span><textarea className="se-textarea" rows={2} maxLength={300} value={form.conditionNote} onChange={(e) => set({ conditionNote: e.target.value })} /></label>
                </li>
            </ol>
            {checkIn.isError && <div className="se-alert" role="alert">{errorMessage(checkIn.error)}</div>}
            <div className="sa-form-actions">
                <span className="sa-muted">Completing activates the contract, occupies the unit and issues the access code.</span>
                <button type="button" className="se-btn se-btn-primary" disabled={!ready || checkIn.isPending} onClick={() => checkIn.mutate()}>
                    {checkIn.isPending ? 'Completing…' : 'Complete check-in'}
                </button>
            </div>
        </div>
    );
}

/** Drafts the contract a check-in needs, at the active policy's rent. */
function DraftContract({ reservation }) {
    const queryClient = useQueryClient();
    const [paymentDay, setPaymentDay] = useState(Math.min(Number(reservation.moveInDate.slice(8, 10)), 28));
    const draft = useMutation({
        mutationFn: () => contractsApi.create({ reservationId: reservation.reservationId, paymentDay }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts'] }),
    });
    return (
        <>
            <p>This reservation has no contract yet. Draft one; the customer then signs it from My Storage.</p>
            <label><span className="se-label">Rent due on day of month (1–28)</span>
                <div className="se-input"><input type="number" min={1} max={28} value={paymentDay} onChange={(e) => setPaymentDay(Number(e.target.value))} /></div>
            </label>
            {draft.isError && <div className="se-alert" role="alert">{errorMessage(draft.error)}</div>}
            <div className="sa-form-actions">
                <button type="button" className="se-btn se-btn-primary" disabled={draft.isPending || !(paymentDay >= 1 && paymentDay <= 28)} onClick={() => draft.mutate()}>
                    {draft.isPending ? 'Drafting…' : 'Draft contract'}
                </button>
            </div>
        </>
    );
}

function CheckInDesk() {
    const today = todayIso();
    const reservations = useReservations({ status: 'Confirmed' });
    const drafts = useContracts({ status: 'Draft' });
    const [selected, setSelected] = useState(null);
    const queue = [...(reservations.data ?? [])].sort((a, b) => a.moveInDate.localeCompare(b.moveInDate));
    const current = queue.find((r) => r.reservationId === selected) ?? queue[0];
    const contract = current && (drafts.data ?? []).find((c) => c.reservationId === current.reservationId);

    return (
        <div className="sa-split open">
            <section className="se-panel">
                <div className="sa-card-title"><h2>Waiting for check-in</h2><span className="se-count">{queue.length}</span></div>
                <div className="sa-queue">
                    {queue.map((r) => (
                        <button key={r.reservationId} type="button" className={`sa-queue-item${current?.reservationId === r.reservationId ? ' active' : ''}`} onClick={() => setSelected(r.reservationId)}>
                            <span><strong>{r.customerName}</strong><small>{r.unitCode} · {r.unitTypeName}</small></span>
                            <span className={`se-badge ${r.moveInDate <= today ? 'low' : ''}`}>{r.moveInDate <= today ? 'Due' : formatDate(r.moveInDate)}</span>
                        </button>
                    ))}
                    {!queue.length && <p className="sa-muted">{reservations.isLoading ? 'Loading…' : 'No confirmed reservations waiting.'}</p>}
                </div>
            </section>
            <div>
                {current && contract && <CheckInWizard key={current.reservationId} reservation={current} contract={contract} onDone={() => setSelected(null)} />}
                {current && !contract && !drafts.isLoading && (
                    <div className="se-panel">
                        <h2>{current.customerName} → Unit {current.unitCode}</h2>
                        <p className="sa-muted">{current.reservationCode} · {formatDate(current.moveInDate)} → {formatDate(rentalEndDate(current.moveInDate, current.rentalMonths))}</p>
                        <DraftContract key={current.reservationId} reservation={current} />
                    </div>
                )}
            </div>
        </div>
    );
}

/** SR-02: undo a check-in made by mistake. The reservation goes back to waiting for a unit. */
function CancelCheckIn({ contractId }) {
    const queryClient = useQueryClient();
    const checkIns = useQuery({ queryKey: ['check-ins', 'Completed'], queryFn: () => checkInsApi.list({ status: 'Completed', page: 1, pageSize: 100 }) });
    const checkIn = checkIns.data?.items?.find((c) => c.contractId === contractId);
    const cancel = useMutation({
        mutationFn: () => checkInsApi.cancel(checkIn.checkInId),
        onSuccess: () => ['check-ins', 'contracts', 'reservations', 'storage-units'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] })),
    });
    if (!checkIn) return null;
    return (
        <>
            {cancel.isError && <div className="se-alert" role="alert">{errorMessage(cancel.error)}</div>}
            <button type="button" className="se-btn se-btn-ghost" disabled={cancel.isPending}
                onClick={() => window.confirm('Cancel this check-in? The contract is terminated, the code revoked and the unit freed; the reservation waits for a unit again.') && cancel.mutate()}>
                Cancel check-in
            </button>
        </>
    );
}

const visitTime = (iso) => new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** SR-05: record the customer entering and leaving their unit during the rental. */
function UnitVisits({ contractId }) {
    const queryClient = useQueryClient();
    const [note, setNote] = useState('');
    const visits = useQuery({ queryKey: ['unit-visits', contractId], queryFn: () => unitVisitsApi.list({ contractId, page: 1, pageSize: 5 }) });
    const open = visits.data?.items?.find((v) => !v.checkOutAt);
    const done = { onSuccess: () => { setNote(''); queryClient.invalidateQueries({ queryKey: ['unit-visits', contractId] }); } };
    const checkIn = useMutation({ mutationFn: () => unitVisitsApi.checkIn({ contractId, note: note.trim() || null }), ...done });
    const checkOut = useMutation({ mutationFn: () => unitVisitsApi.checkOut(open.unitVisitId), ...done });
    const error = checkIn.error ?? checkOut.error;
    return (
        <div>
            <h3>Unit visits</h3>
            {open ? (
                <p className="sa-muted">Inside since {visitTime(open.checkInAt)}{open.note ? ` · ${open.note}` : ''}</p>
            ) : (
                <label><span className="se-label">Note (optional)</span>
                    <div className="se-input"><input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} /></div></label>
            )}
            {error && <div className="se-alert" role="alert">{errorMessage(error)}</div>}
            {open
                ? <button type="button" className="se-btn se-btn-primary" disabled={checkOut.isPending} onClick={() => checkOut.mutate()}>Check out</button>
                : <button type="button" className="se-btn se-btn-primary" disabled={checkIn.isPending} onClick={() => checkIn.mutate()}>Check in visit</button>}
            <ul className="sa-people">
                {(visits.data?.items ?? []).filter((v) => v.checkOutAt).map((v) => (
                    <li key={v.unitVisitId}><span>{visitTime(v.checkInAt)} → {visitTime(v.checkOutAt)}</span><small>{v.recordedByName}</small></li>
                ))}
            </ul>
        </div>
    );
}

/** TH-06: a lost card or leaked code. The customer gets a new code from their unit page. */
function RevokeCode({ contractId, accessCodeId }) {
    const queryClient = useQueryClient();
    const revoke = useMutation({
        mutationFn: () => accessCodesApi.revoke(accessCodeId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts', contractId, 'access-code'] }),
    });
    const confirmAndRevoke = () => {
        if (window.confirm('Revoke this access code? The customer cannot open the unit until they request a new code.')) revoke.mutate();
    };
    return (
        <>
            {revoke.isError && <div className="se-alert" role="alert">{errorMessage(revoke.error)}</div>}
            <button type="button" className="se-btn se-btn-ghost" disabled={revoke.isPending} onClick={confirmAndRevoke}>
                <Icon name="key" size={16} /> {revoke.isPending ? 'Revoking…' : 'Revoke code'}
            </button>
        </>
    );
}

function ActiveRentals() {
    const contracts = useContracts({ status: 'Active' });
    const invoices = useInvoices();
    const [selected, setSelected] = useState(null);
    const list = contracts.data ?? [];
    const current = list.find((c) => c.contractId === selected) ?? list[0];
    const code = useQuery({
        queryKey: ['contracts', current?.contractId, 'access-code'],
        queryFn: () => contractsApi.accessCode(current.contractId),
        enabled: !!current,
    });
    const owing = current && (invoices.data ?? []).filter((i) => i.contractId === current.contractId && ['Issued', 'Overdue'].includes(i.status));
    const overdue = owing?.some((i) => i.status === 'Overdue');
    const eligible = current && !overdue && code.data?.isActive;

    return (
        <div className="sa-split open">
            <section className="se-panel">
                <div className="sa-card-title"><h2>Active rentals</h2><span className="se-count">{list.length}</span></div>
                <div className="sa-queue">
                    {list.map((c) => (
                        <button key={c.contractId} type="button" className={`sa-queue-item${current?.contractId === c.contractId ? ' active' : ''}`} onClick={() => setSelected(c.contractId)}>
                            <span><strong>{c.customerName}</strong><small>Unit {c.unitCode} · to {formatDate(c.endDate)}</small></span>
                            <Status value={c.status} />
                        </button>
                    ))}
                    {!list.length && <p className="sa-muted">{contracts.isLoading ? 'Loading…' : 'No active rentals.'}</p>}
                </div>
            </section>
            {current && (
                <section className="se-panel">
                    <div className="sa-card-title"><h2>{current.customerName} → Unit {current.unitCode}</h2><span className="sa-muted">{current.contractNumber}</span></div>
                    <dl className="se-kv">
                        <div><dt>Contract status</dt><dd><Status value={current.status} /></dd></div>
                        <div><dt>Payment status</dt><dd>{owing?.length ? `${owing.length} open invoice${owing.length > 1 ? 's' : ''}${overdue ? ' · overdue' : ''}` : 'Paid up'}</dd></div>
                        <div><dt>Access code</dt><dd>{code.data?.isActive ? `Active · expires ${formatDate(code.data.expiresAt)}` : 'No active code'}</dd></div>
                    </dl>
                    <div className={`sa-eligibility ${eligible ? 'ok' : 'no'}`}>
                        <small>Access eligibility</small>
                        <strong>{eligible ? 'Eligible for access' : 'Not eligible — check payment or access code'}</strong>
                    </div>
                    {code.data?.isActive && <RevokeCode key={code.data.accessCodeId} contractId={current.contractId} accessCodeId={code.data.accessCodeId} />}
                    <CancelCheckIn key={current.contractId} contractId={current.contractId} />
                    <UnitVisits key={`visits-${current.contractId}`} contractId={current.contractId} />
                </section>
            )}
        </div>
    );
}

/** A06: the on-site desk — hand over newly booked units, and see who may access their unit. */
export default function CheckInPage() {
    const [tab, setTab] = useState('desk');
    const units = useUnits();
    const reservations = useReservations({ status: 'Confirmed' });
    const active = useContracts({ status: 'Active' });
    const all = units.data ?? [];

    return (
        <>
            <PageHeader title="Check-in" subtitle={`Today, ${formatDate(todayIso())}`} />
            <div className="sa-stats">
                <Stat icon="key" label="Waiting for check-in" value={reservations.data?.length ?? 0} />
                <Stat icon="file" label="Active rentals" value={active.data?.length ?? 0} />
                <Stat icon="grid" label="Available units" value={all.filter((u) => u.status === 'Available').length} />
                <Stat icon="shield" tone="warn" label="In maintenance" value={all.filter((u) => u.status === 'Maintenance').length} />
            </div>
            <div className="se-tabs se-tabs-line" role="tablist">
                <button role="tab" aria-selected={tab === 'desk'} className={tab === 'desk' ? 'active' : ''} onClick={() => setTab('desk')}>Check-in desk</button>
                <button role="tab" aria-selected={tab === 'active'} className={tab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>Active rentals &amp; access</button>
            </div>
            {tab === 'desk' ? <CheckInDesk /> : <ActiveRentals />}
        </>
    );
}
