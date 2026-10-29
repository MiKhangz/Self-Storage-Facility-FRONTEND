import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { checkInsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../../customer/components/Icon.jsx';
import { formatDate, todayIso } from '../../customer/components/format.js';
import { Modal, PageHeader, Stat } from '../components/ui.jsx';
import { useT } from '../../i18n/I18n.jsx';

const time = (iso) => iso && new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
/** Now, as the value of a datetime-local input in Vietnam time. */
const nowLocal = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 16);
const LEFT_HOW = { MarkedByStaff: 'marked by staff', AutoAtClosing: 'auto at closing' };

/** The customer left without checking out: staff record roughly when, and why. The activity log keeps who did it. */
function MarkLeft({ row, onClose }) {
    const tr = useT();
    const queryClient = useQueryClient();
    const [form, setForm] = useState({ leftAt: nowLocal(), reason: '' });
    const save = useMutation({
        // Sent as Vietnam wall-clock time; the API converts it.
        mutationFn: () => checkInsApi.markLeft(row.openCheckInId, { leftAt: `${form.leftAt}:00`, reason: form.reason.trim() }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['check-ins'] }); onClose(); },
    });
    return (
        <Modal onClose={onClose}>
            <form className="se-panel sa-dialog" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
                <div className="sa-card-title"><h2>Mark {row.customerName} as left</h2>
                    <button type="button" className="sa-close" onClick={onClose} aria-label={tr('Close')}>×</button></div>
                <p className="sa-muted">Use this only when the customer left without checking out at the desk. Inside since {time(row.since)}. Their code is replaced, as after any visit.</p>
                <label><span className="se-label">{tr('When did they leave?')}</span>
                    <div className="se-input"><input type="datetime-local" required value={form.leftAt} max={nowLocal()} onChange={(e) => setForm({ ...form, leftAt: e.target.value })} /></div></label>
                <label><span className="se-label">{tr('Reason *')}</span>
                    <div className="se-input"><input required maxLength={200} placeholder={tr('e.g. Forgot to check out at the desk')} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div></label>
                {save.isError && <div className="se-alert" role="alert">{errorMessage(save.error)}</div>}
                <div className="sa-form-actions">
                    <button type="button" className="se-btn se-btn-ghost" onClick={onClose}>{tr('Cancel')}</button>
                    <button type="submit" className="se-btn se-btn-primary" disabled={!form.reason.trim() || save.isPending}>{save.isPending ? 'Saving…' : 'Mark as left'}</button>
                </div>
            </form>
        </Modal>
    );
}

/**
 * SR-05: who is inside the facility right now. The customer says their access code at the desk, both coming in and
 * going out; staff find them by it and check them in (green) or out (red). The handover checks a new renter in.
 */
export default function CheckInPage() {
    const tr = useT();
    const queryClient = useQueryClient();
    // Another desk may check someone in or out, so the board refreshes on its own.
    const board = useQuery({ queryKey: ['check-ins', 'board'], queryFn: checkInsApi.board, refetchInterval: 30_000 });
    const [code, setCode] = useState('');
    const [marking, setMarking] = useState(null);
    const find = useMutation({ mutationFn: () => checkInsApi.find({ accessCode: code.trim() }) });
    const done = { onSuccess: () => { setCode(''); find.reset(); queryClient.invalidateQueries({ queryKey: ['check-ins'] }); } };
    const checkIn = useMutation({ mutationFn: (contractId) => checkInsApi.checkIn({ contractId, note: null }), ...done });
    const checkOut = useMutation({ mutationFn: (checkInId) => checkInsApi.checkOut(checkInId), ...done });

    const rows = board.data ?? [];
    const found = find.data && rows.find((r) => r.contractId === find.data.contractId);
    const busy = checkIn.isPending || checkOut.isPending;
    const error = checkIn.error ?? checkOut.error;

    return (
        <>
            <PageHeader title={tr('Check-in / Check-out')} subtitle={`Today, ${formatDate(todayIso())}`} />
            <div className="sa-stats">
                <Stat icon="key" label="Inside now" value={rows.filter((r) => r.inside).length} />
                <Stat icon="file" label="Renting here" value={rows.length} />
                <Stat icon="shield" tone="warn" label="No working code" value={rows.filter((r) => !r.canEnter).length} />
            </div>

            <section className="se-panel sa-checkin-find">
                <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) find.mutate(); }}>
                    <label><span className="se-label">Customer's access code (coming in or going out; it changes after each visit)</span>
                        <div className="se-input"><Icon name="key" size={16} />
                            <input inputMode="numeric" autoComplete="off" maxLength={20} placeholder={tr('Ask the customer for their code')} value={code}
                                onChange={(e) => { setCode(e.target.value); find.reset(); }} /></div></label>
                    <button type="submit" className="se-btn se-btn-primary" disabled={!code.trim() || find.isPending}>{find.isPending ? 'Finding…' : 'Find'}</button>
                </form>
                {find.isError && <div className="se-alert" role="alert">{errorMessage(find.error)}</div>}
                {found && (
                    <div className={`sa-found ${found.inside ? 'in' : 'out'}`}>
                        <span><strong>{found.customerName}</strong>
                            <small>Unit {found.unitCode} · {found.inside ? `inside since ${time(found.since)}` : tr('not inside')}</small></span>
                        {found.inside
                            ? <button type="button" className="se-btn sa-btn-red" disabled={busy} onClick={() => checkOut.mutate(found.openCheckInId)}>{checkOut.isPending ? 'Checking out…' : 'Check out'}</button>
                            : <button type="button" className="se-btn sa-btn-green" disabled={busy} onClick={() => checkIn.mutate(found.contractId)}>{checkIn.isPending ? 'Checking in…' : 'Check in'}</button>}
                    </div>
                )}
                {error && <div className="se-alert" role="alert">{errorMessage(error)}</div>}
            </section>

            <section className="se-card se-table-wrap">
                <table className="se-table sa-table">
                    <thead><tr><th>{tr('Status')}</th><th>{tr('Customer')}</th><th>{tr('Unit')}</th><th>{tr('Facility')}</th><th>{tr('Since')}</th><th aria-label={tr('Fix a mistake')} /></tr></thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.contractId} className={found?.contractId === r.contractId ? 'active' : ''}>
                                <td><span className={`sa-presence ${r.inside ? 'in' : 'out'}`}>{r.inside ? 'Inside' : 'Out'}</span></td>
                                <td className="strong">{r.customerName}<div className="sa-muted">{r.customerPhone}</div></td>
                                <td>{r.unitCode}</td>
                                <td>{r.facilityName}</td>
                                <td>{r.since ? time(r.since) : '—'}
                                    {LEFT_HOW[r.leftHow] && <div className="sa-muted">Left · {tr(LEFT_HOW[r.leftHow])}</div>}
                                    {!r.canEnter && <div className="sa-muted">{tr('No working code')}</div>}</td>
                                <td>{r.inside && (
                                    <button type="button" className="se-btn se-btn-ghost se-btn-sm" onClick={() => setMarking(r)}
                                        title={tr('The customer already left without checking out')}>{tr('Mark as left')}</button>
                                )}</td>
                            </tr>
                        ))}
                        {!rows.length && <tr><td colSpan={6} className="sa-muted">{board.isLoading ? 'Loading…' : board.isError ? errorMessage(board.error) : 'Nobody is renting at your facilities yet.'}</td></tr>}
                    </tbody>
                </table>
            </section>
            {marking && <MarkLeft row={marking} onClose={() => setMarking(null)} />}
        </>
    );
}
