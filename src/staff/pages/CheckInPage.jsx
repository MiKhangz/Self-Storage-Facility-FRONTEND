import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { checkInsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../../customer/components/Icon.jsx';
import { formatDate, todayIso } from '../../customer/components/format.js';
import { PageHeader, Stat } from '../components/ui.jsx';

const time = (iso) => iso && new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/**
 * SR-05: who is inside the facility right now. The customer says their access code at the desk; staff find them by
 * it and check them in (green). When they leave, staff check them out (red).
 */
export default function CheckInPage() {
    const queryClient = useQueryClient();
    // Another desk may check someone in or out, so the board refreshes on its own.
    const board = useQuery({ queryKey: ['check-ins', 'board'], queryFn: checkInsApi.board, refetchInterval: 30_000 });
    const [code, setCode] = useState('');
    const find = useMutation({ mutationFn: () => checkInsApi.find({ accessCode: code.trim() }) });
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['check-ins'] });
    const checkIn = useMutation({
        mutationFn: (contractId) => checkInsApi.checkIn({ contractId, note: null }),
        onSuccess: () => { setCode(''); find.reset(); refresh(); },
    });
    const checkOut = useMutation({ mutationFn: (checkInId) => checkInsApi.checkOut(checkInId), onSuccess: refresh });

    const rows = board.data ?? [];
    const found = find.data && rows.find((r) => r.contractId === find.data.contractId);
    const error = checkIn.error ?? checkOut.error;

    return (
        <>
            <PageHeader title="Check-in / Check-out" subtitle={`Today, ${formatDate(todayIso())}`} />
            <div className="sa-stats">
                <Stat icon="key" label="Inside now" value={rows.filter((r) => r.inside).length} />
                <Stat icon="file" label="Renting here" value={rows.length} />
                <Stat icon="shield" tone="warn" label="No working code" value={rows.filter((r) => !r.canEnter).length} />
            </div>

            <section className="se-panel sa-checkin-find">
                <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) find.mutate(); }}>
                    <label><span className="se-label">Customer's access code</span>
                        <div className="se-input"><Icon name="key" size={16} />
                            <input inputMode="numeric" autoComplete="off" maxLength={20} placeholder="Ask the customer for their code" value={code}
                                onChange={(e) => { setCode(e.target.value); find.reset(); }} /></div></label>
                    <button type="submit" className="se-btn se-btn-primary" disabled={!code.trim() || find.isPending}>{find.isPending ? 'Finding…' : 'Find'}</button>
                </form>
                {find.isError && <div className="se-alert" role="alert">{errorMessage(find.error)}</div>}
                {found && (
                    <div className={`sa-found ${found.inside ? 'in' : 'out'}`}>
                        <span><strong>{found.customerName}</strong><small>Unit {found.unitCode} · {found.contractNumber}</small></span>
                        {found.inside
                            ? <span className="sa-muted">Already inside since {time(found.since)}</span>
                            : <button type="button" className="se-btn sa-btn-green" disabled={checkIn.isPending} onClick={() => checkIn.mutate(found.contractId)}>
                                {checkIn.isPending ? 'Checking in…' : 'Check in'}</button>}
                    </div>
                )}
            </section>

            {error && <div className="se-alert" role="alert">{errorMessage(error)}</div>}
            <section className="se-card se-table-wrap">
                <table className="se-table sa-table">
                    <thead><tr><th>Status</th><th>Customer</th><th>Unit</th><th>Facility</th><th>Since</th><th aria-label="Action" /></tr></thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.contractId} className={found?.contractId === r.contractId ? 'active' : ''}>
                                <td><span className={`sa-presence ${r.inside ? 'in' : 'out'}`}>{r.inside ? 'Inside' : 'Out'}</span></td>
                                <td className="strong">{r.customerName}<div className="sa-muted">{r.customerPhone}</div></td>
                                <td>{r.unitCode}</td>
                                <td>{r.facilityName}</td>
                                <td>{r.since ? time(r.since) : '—'}{!r.canEnter && <div className="sa-muted">No working code</div>}</td>
                                <td>{r.inside && (
                                    <button type="button" className="se-btn sa-btn-red se-btn-sm" disabled={checkOut.isPending}
                                        onClick={() => checkOut.mutate(r.openCheckInId)}>Check out</button>
                                )}</td>
                            </tr>
                        ))}
                        {!rows.length && <tr><td colSpan={6} className="sa-muted">{board.isLoading ? 'Loading…' : board.isError ? errorMessage(board.error) : 'Nobody is renting at your facilities yet.'}</td></tr>}
                    </tbody>
                </table>
            </section>
        </>
    );
}
