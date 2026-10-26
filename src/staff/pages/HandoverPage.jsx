import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accessCodesApi, handoversApi, contractsApi, reservationsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../../customer/components/Icon.jsx';
import { formatDate, todayIso } from '../../customer/components/format.js';
import { PageHeader, Stat, Status } from '../components/ui.jsx';
import { useContracts, useInvoices, useReservations, useUnits } from '../queries.js';

/** Checked at the desk before anyone walks to the unit. */
const CHECKS = [
    { key: 'identity', title: 'Verify identity', text: 'Citizen ID (CCCD) matches the renter name' },
    { key: 'payment', title: 'Verify payment', text: 'The deposit is paid (handover is refused until it is)' },
];

/** Staff walk the customer to the unit. They like it, want another of the same size, or call the booking off. */
function ViewUnit({ reservation, viewed, onViewed }) {
    const queryClient = useQueryClient();
    const [picking, setPicking] = useState(false);
    const [unitId, setUnitId] = useState('');
    const others = (useUnits({ facilityId: reservation.facilityId, unitTypeId: reservation.unitTypeId, status: 'Available' }).data ?? [])
        .filter((u) => u.storageUnitId !== reservation.storageUnitId);
    const refresh = () => ['reservations', 'contracts', 'storage-units'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    const swap = useMutation({
        mutationFn: () => reservationsApi.changeUnit(reservation.reservationId, { storageUnitId: Number(unitId) }),
        onSuccess: () => { setPicking(false); setUnitId(''); refresh(); },
    });
    const cancel = useMutation({
        mutationFn: () => reservationsApi.cancel(reservation.reservationId, { reason: 'Customer did not take a unit at the handover' }),
        onSuccess: refresh,
    });
    const error = swap.error ?? cancel.error;

    return (
        <li className={viewed ? 'done' : ''}>
            <span><strong>Show the customer unit {reservation.unitCode}</strong>
                <small>{viewed ? 'The customer likes the unit.' : 'Walk them to the unit. Sign nothing until they are happy with it.'}</small></span>
            {!viewed && !picking && (
                <div className="sa-form-actions">
                    <button type="button" className="se-btn se-btn-ghost se-btn-sm" disabled={cancel.isPending}
                        onClick={() => window.confirm('Cancel this booking? The unit is freed and the full deposit is owed back to the customer.') && cancel.mutate()}>
                        Cancel booking
                    </button>
                    <button type="button" className="se-btn se-btn-ghost se-btn-sm" onClick={() => setPicking(true)}>Show another unit</button>
                    <button type="button" className="se-btn se-btn-primary se-btn-sm" onClick={onViewed}>Customer likes it</button>
                </div>
            )}
            {picking && (
                <div className="sa-inline-form">
                    <label><span className="se-label">Another free {reservation.unitTypeName} unit</span>
                        <div className="se-input"><select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                            <option value="">{others.length ? 'Choose a unit' : 'No other free unit of this size'}</option>
                            {others.map((u) => <option key={u.storageUnitId} value={u.storageUnitId}>{u.unitCode}{u.floorName ? ` · ${u.floorName}` : ''}{u.zone ? ` · zone ${u.zone}` : ''}</option>)}
                        </select></div></label>
                    <p className="se-hint">If the contract was already signed, it must be signed again for the new unit.</p>
                    <div className="sa-form-actions">
                        <button type="button" className="se-btn se-btn-ghost se-btn-sm" onClick={() => setPicking(false)}>Back</button>
                        <button type="button" className="se-btn se-btn-primary se-btn-sm" disabled={!unitId || swap.isPending} onClick={() => swap.mutate()}>
                            {swap.isPending ? 'Switching…' : 'Switch to this unit'}
                        </button>
                    </div>
                </div>
            )}
            {error && <div className="se-alert" role="alert">{errorMessage(error)}</div>}
        </li>
    );
}

/** The contract is drafted once the customer likes the unit, then signed on paper in front of staff. */
function SignContract({ reservation, contract, locked }) {
    const queryClient = useQueryClient();
    const [paymentDay, setPaymentDay] = useState(Math.min(Number(reservation.moveInDate.slice(8, 10)), 28));
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['contracts'] });
    const draft = useMutation({ mutationFn: () => contractsApi.create({ reservationId: reservation.reservationId, paymentDay }), onSuccess: refresh });
    const sign = useMutation({ mutationFn: () => contractsApi.signAtDesk(contract.contractId), onSuccess: refresh });
    const error = draft.error ?? sign.error;

    return (
        <li className={contract?.signedAt ? 'done' : ''}>
            <span><strong>Customer signs the contract</strong>
                <small>{locked ? 'After the customer has seen and accepted the unit.'
                    : contract?.signedAt ? `${contract.contractNumber} signed ${formatDate(contract.signedAt)}`
                    : contract ? `Print ${contract.contractNumber}; the customer signs the paper copy in front of you.`
                    : 'Draft the contract for this unit, then print it for signing.'}</small></span>
            {!locked && !contract && (
                <div className="sa-inline-form">
                    <label><span className="se-label">Rent due on day of month (1–28)</span>
                        <div className="se-input"><input type="number" min={1} max={28} value={paymentDay} onChange={(e) => setPaymentDay(Number(e.target.value))} /></div></label>
                    <button type="button" className="se-btn se-btn-ghost se-btn-sm" disabled={draft.isPending || !(paymentDay >= 1 && paymentDay <= 28)} onClick={() => draft.mutate()}>
                        {draft.isPending ? 'Drafting…' : 'Draft contract'}
                    </button>
                </div>
            )}
            {!locked && contract && !contract.signedAt && (
                <button type="button" className="se-btn se-btn-ghost se-btn-sm" disabled={sign.isPending}
                    onClick={() => window.confirm('Confirm the customer signed the paper contract in front of you?') && sign.mutate()}>
                    Customer signed on paper
                </button>
            )}
            {error && <div className="se-alert" role="alert">{errorMessage(error)}</div>}
        </li>
    );
}

function HandoverWizard({ reservation, contract, onDone }) {
    const queryClient = useQueryClient();
    const [ticks, setTicks] = useState({});
    // Seeing the unit is a conversation, not a record: it lives here, and switching units resets it.
    const [viewedUnit, setViewedUnit] = useState(null);
    const viewed = viewedUnit === reservation.storageUnitId;
    // Each unit's disc lock is named after the unit, so staff confirm they gave that one; a unit switch resets it.
    const [lockFor, setLockFor] = useState(null);
    const lockGiven = lockFor === reservation.storageUnitId;
    const [form, setForm] = useState({ conditionNote: '' });
    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    const handover = useMutation({
        mutationFn: () => handoversApi.create({ reservationId: reservation.reservationId, contractId: contract.contractId, lockSerial: reservation.unitCode, ...form }),
    });
    // Refresh only after staff move on: refetching drops this reservation from the queue, which would unmount
    // the one-time access code before anyone reads it.
    const next = () => {
        ['reservations', 'contracts', 'storage-units'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
        onDone();
    };

    if (handover.data) {
        return (
            <div className="se-panel sa-checkin-done">
                <span className="se-confirm-icon"><Icon name="check" size={28} /></span>
                <h2>Handover complete — unit {handover.data.unitCode} is now occupied</h2>
                <p className="sa-muted">Give the customer this access code. It is shown once only.</p>
                <div className="se-code-digits dark">{(handover.data.accessCode ?? '').split('').map((d, i) => <span key={i}>{d}</span>)}</div>
                <button type="button" className="se-btn se-btn-primary" onClick={next}>Next handover</button>
            </div>
        );
    }

    const checked = CHECKS.every((c) => ticks[c.key]);
    const signed = !!contract?.signedAt;
    const ready = checked && viewed && signed && lockGiven;
    return (
        <div className="se-panel">
            <div className="sa-card-title">
                <h2>Handover · {reservation.customerName} → Unit {reservation.unitCode}</h2>
                <span className="sa-muted">{reservation.reservationCode}{contract ? ` · ${contract.contractNumber}` : ''}</span>
            </div>
            <ol className="sa-steps">
                {CHECKS.map((c) => (
                    <li key={c.key} className={ticks[c.key] ? 'done' : ''}>
                        <label className="se-check"><input type="checkbox" checked={!!ticks[c.key]} onChange={(e) => setTicks({ ...ticks, [c.key]: e.target.checked })} />
                            <span><strong>{c.title}</strong><small>{c.text}</small></span></label>
                    </li>
                ))}
                <ViewUnit reservation={reservation} viewed={viewed} onViewed={() => setViewedUnit(reservation.storageUnitId)} />
                <SignContract reservation={reservation} contract={contract} locked={!viewed} />
                <li>
                    <span><strong>Hand over the disc lock and keys</strong><small>Give the customer the lock named after their unit</small></span>
                    <div>
                        <div><span className="se-label">Lock name</span>
                            <div className={`sa-lock ${lockGiven ? 'given' : ''}`}>
                                <span><Icon name="key" size={16} /> {reservation.unitCode}</span>
                                {lockGiven
                                    ? <button type="button" className="se-btn se-btn-ghost se-btn-sm" onClick={() => setLockFor(null)}>Undo</button>
                                    : <button type="button" className="se-btn se-btn-primary se-btn-sm" onClick={() => setLockFor(reservation.storageUnitId)}>Confirm lock given</button>}
                            </div>
                            {lockGiven && <small className="sa-muted">Lock {reservation.unitCode} given to the customer.</small>}
                        </div>
                    </div>
                    <label><span className="se-label">Condition note (optional, shown again at the return inspection)</span><textarea className="se-textarea" rows={2} maxLength={300} value={form.conditionNote} onChange={(e) => set({ conditionNote: e.target.value })} /></label>
                </li>
            </ol>
            {handover.isError && <div className="se-alert" role="alert">{errorMessage(handover.error)}</div>}
            <div className="sa-form-actions">
                <span className="sa-muted">Completing activates the contract, occupies the unit and issues the access code.</span>
                <button type="button" className="se-btn se-btn-primary" disabled={!ready || handover.isPending} onClick={() => handover.mutate()}>
                    {handover.isPending ? 'Completing…' : 'Complete handover'}
                </button>
            </div>
        </div>
    );
}

function HandoverDesk() {
    const today = todayIso();
    const reservations = useReservations({ status: 'Confirmed' });
    const drafts = useContracts({ status: 'Draft' });
    const [selected, setSelected] = useState(null);
    // A Confirmed booking without a unit (its handover was undone) is assigned on Reservations first.
    const queue = [...(reservations.data ?? [])].filter((r) => r.storageUnitId).sort((a, b) => a.moveInDate.localeCompare(b.moveInDate));
    const current = queue.find((r) => r.reservationId === selected) ?? queue[0];
    const contract = current && (drafts.data ?? []).find((c) => c.reservationId === current.reservationId);

    return (
        <div className="sa-split open sa-desk">
            <section className="se-panel">
                <div className="sa-card-title"><h2>Waiting for handover</h2><span className="se-count">{queue.length}</span></div>
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
                {current && !drafts.isLoading && <HandoverWizard key={current.reservationId} reservation={current} contract={contract} onDone={() => setSelected(null)} />}
            </div>
        </div>
    );
}

/** SR-02: undo a handover made by mistake. The reservation goes back to waiting for a unit. */
function CancelHandover({ contractId }) {
    const queryClient = useQueryClient();
    const handovers = useQuery({ queryKey: ['handovers', 'Completed'], queryFn: () => handoversApi.list({ status: 'Completed', page: 1, pageSize: 100 }) });
    const handover = handovers.data?.items?.find((c) => c.contractId === contractId);
    const cancel = useMutation({
        mutationFn: () => handoversApi.cancel(handover.handoverId),
        onSuccess: () => ['handovers', 'contracts', 'reservations', 'storage-units'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] })),
    });
    if (!handover) return null;
    return (
        <>
            {cancel.isError && <div className="se-alert" role="alert">{errorMessage(cancel.error)}</div>}
            <button type="button" className="se-btn se-btn-ghost" disabled={cancel.isPending}
                onClick={() => window.confirm('Cancel this handover? The contract is terminated, the code revoked and the unit freed; the reservation waits for a unit again.') && cancel.mutate()}>
                Cancel handover
            </button>
        </>
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
        <div className="sa-split open sa-desk">
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
                    <CancelHandover key={current.contractId} contractId={current.contractId} />
                </section>
            )}
        </div>
    );
}

/** A06: the on-site desk — hand over newly booked units, and see who may access their unit. */
export default function HandoverPage() {
    const [tab, setTab] = useState('desk');
    const units = useUnits();
    const reservations = useReservations({ status: 'Confirmed' });
    const active = useContracts({ status: 'Active' });
    const all = units.data ?? [];

    return (
        <>
            <PageHeader title="Handover" subtitle={`Today, ${formatDate(todayIso())}`} />
            <div className="sa-stats">
                <Stat icon="key" label="Waiting for handover" value={reservations.data?.length ?? 0} />
                <Stat icon="file" label="Active rentals" value={active.data?.length ?? 0} />
                <Stat icon="grid" label="Available units" value={all.filter((u) => u.status === 'Available').length} />
                <Stat icon="shield" tone="warn" label="In maintenance" value={all.filter((u) => u.status === 'Maintenance').length} />
            </div>
            <div className="se-tabs se-tabs-line" role="tablist">
                <button role="tab" aria-selected={tab === 'desk'} className={tab === 'desk' ? 'active' : ''} onClick={() => setTab('desk')}>Handover desk</button>
                <button role="tab" aria-selected={tab === 'active'} className={tab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>Active rentals &amp; access</button>
            </div>
            {tab === 'desk' ? <HandoverDesk /> : <ActiveRentals />}
        </>
    );
}
