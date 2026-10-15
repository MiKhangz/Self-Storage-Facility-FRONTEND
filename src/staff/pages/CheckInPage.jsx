import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { contractsApi, handoversApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../../customer/components/Icon.jsx';
import { formatDate, rentalEndDate, todayIso } from '../../customer/components/format.js';
import { NotWired, PageHeader, Stat, Status } from '../components/ui.jsx';
import { useContracts, useInvoices, useReservations, useUnits } from '../queries.js';

/** The physical checks the Figma lists before keys change hands; staff tick each one. */
const CHECKS = [
    { key: 'identity', title: 'Verify identity', text: 'Citizen ID (CCCD) matches the renter name' },
    { key: 'payment', title: 'Verify payment', text: 'The deposit is paid (handover is refused until it is)' },
    { key: 'inspect', title: 'Inspect unit with customer', text: 'Agree the condition before handing over' },
];

function HandoverWizard({ reservation, contract, onDone }) {
    const queryClient = useQueryClient();
    const [ticks, setTicks] = useState({});
    const [form, setForm] = useState({ lockSerial: '', cardNumber: '', conditionNote: '' });
    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    const handover = useMutation({
        mutationFn: () => handoversApi.create({ reservationId: reservation.reservationId, contractId: contract.contractId, ...form }),
    });
    // Refresh only after staff move on: refetching drops this reservation from the queue, which would unmount
    // the one-time access code before anyone reads it.
    const next = () => {
        ['reservations', 'contracts', 'storage-units'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
        onDone();
    };

    if (handover.data) {
        return (
            <div className="se-panel sa-handover-done">
                <span className="se-confirm-icon"><Icon name="check" size={28} /></span>
                <h2>Handover complete — unit {handover.data.unitCode} is now occupied</h2>
                <p className="sa-muted">Give the customer this access code. It is shown once only.</p>
                <div className="se-code-digits dark">{(handover.data.accessCode ?? '').split('').map((d, i) => <span key={i}>{d}</span>)}</div>
                <button type="button" className="se-btn se-btn-primary" onClick={next}>Next check-in</button>
            </div>
        );
    }

    const allTicked = CHECKS.every((c) => ticks[c.key]);
    const ready = allTicked && form.lockSerial.trim() && form.cardNumber.trim() && contract.signedAt;
    return (
        <div className="se-panel">
            <div className="sa-card-title">
                <h2>Handover · {reservation.customerName} → Unit {reservation.unitCode}</h2>
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
                    <span><strong>Customer signs the contract</strong><small>{contract.signedAt ? `Signed ${formatDate(contract.signedAt)}` : 'Waiting — the customer signs from My Storage before handover'}</small></span>
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

/** Drafts the contract a handover needs, at the active policy's rent. */
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

function HandoverDesk() {
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
                {current && contract && <HandoverWizard key={current.reservationId} reservation={current} contract={contract} onDone={() => setSelected(null)} />}
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
                    {/* ponytail: visit check-in/out with a time limit has no backend; wire it when a visits endpoint exists. */}
                    <NotWired>Timed visitor check-in and check-out are not on the backend yet; gate entries appear in the access log.</NotWired>
                </section>
            )}
        </div>
    );
}

/** A06: the on-site desk — hand over newly booked units, and see who may access their unit. */
export default function CheckInPage() {
    const [tab, setTab] = useState('handover');
    const units = useUnits();
    const reservations = useReservations({ status: 'Confirmed' });
    const active = useContracts({ status: 'Active' });
    const all = units.data ?? [];

    return (
        <>
            <PageHeader title="Check-in & Handover" subtitle={`Today, ${formatDate(todayIso())}`} />
            <div className="sa-stats">
                <Stat icon="key" label="Waiting for check-in" value={reservations.data?.length ?? 0} />
                <Stat icon="file" label="Active rentals" value={active.data?.length ?? 0} />
                <Stat icon="grid" label="Available units" value={all.filter((u) => u.status === 'Available').length} />
                <Stat icon="shield" tone="warn" label="In maintenance" value={all.filter((u) => u.status === 'Maintenance').length} />
            </div>
            <div className="se-tabs se-tabs-line" role="tablist">
                <button role="tab" aria-selected={tab === 'handover'} className={tab === 'handover' ? 'active' : ''} onClick={() => setTab('handover')}>Handover desk</button>
                <button role="tab" aria-selected={tab === 'active'} className={tab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>Active rentals &amp; access</button>
            </div>
            {tab === 'handover' ? <HandoverDesk /> : <ActiveRentals />}
        </>
    );
}
