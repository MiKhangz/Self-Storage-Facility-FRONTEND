import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { shiftsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { useAuth } from '../../features/auth/AuthContext';
import { Roles } from '../../features/auth/roles';
import Icon from '../../customer/components/Icon.jsx';
import { addDays, formatDate, todayIso } from '../../customer/components/format.js';
import { initials } from '../../customer/layout/CustomerLayout.jsx';
import { PageHeader, SelectFilter } from '../components/ui.jsx';
import { useFacilities, useShifts, useStaff, useTasks } from '../queries.js';

const TIMES = { Morning: ['07:00', '15:00'], Afternoon: ['15:00', '23:00'], Night: ['23:00', '07:00'] };

/** Monday of the week containing an ISO date. */
export function weekStart(iso) {
    const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
    return addDays(iso, day === 0 ? -6 : 1 - day);
}

/** A13: weekly shift roster per facility, with add and remove for managers. */
export default function ShiftsPage() {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const [start, setStart] = useState(weekStart(todayIso()));
    const facilities = useFacilities().data ?? [];
    const [facilityId, setFacilityId] = useState('');
    const fid = Number(facilityId) || facilities[0]?.facilityId;
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const shifts = useShifts(fid ? { facilityId: fid, from: days[0], to: days[6] } : undefined).data ?? [];
    const tasks = useTasks().data ?? [];
    const isAdmin = session?.role === Roles.SystemAdministrator;
    const canWrite = isAdmin || session?.role === Roles.FacilityManager;
    // Admins and managers can list staff accounts; others pick from people already on the roster.
    const staff = useStaff(undefined, canWrite).data ?? [];
    const people = new Map([...staff.map((s) => [s.userId, s.fullName]), ...shifts.map((s) => [s.userId, s.userName]), [session?.userId, session?.fullName]]);

    const [form, setForm] = useState(null);
    const create = useMutation({
        mutationFn: () => shiftsApi.create({ userId: Number(form.userId), facilityId: fid, shiftDate: form.shiftDate, startTime: `${form.startTime}:00`, endTime: `${form.endTime}:00`, shiftType: form.shiftType }),
        onSuccess: () => { setForm(null); queryClient.invalidateQueries({ queryKey: ['shifts'] }); },
    });
    const remove = useMutation({ mutationFn: (id) => shiftsApi.remove(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shifts'] }) });
    const openForm = () => setForm({ userId: [...people.keys()][0] ?? '', shiftDate: days.includes(todayIso()) ? todayIso() : days[0], shiftType: 'Morning', startTime: TIMES.Morning[0], endTime: TIMES.Morning[1] });

    return (
        <>
            <PageHeader title="Staff & shifts" subtitle={`Week of ${formatDate(days[0])} – ${formatDate(days[6])}`}>
                <button type="button" className="se-btn se-btn-ghost" onClick={() => setStart(addDays(start, -7))} aria-label="Previous week"><Icon name="arrowLeft" size={16} /></button>
                <button type="button" className="se-btn se-btn-ghost" onClick={() => setStart(weekStart(todayIso()))}>This week</button>
                <button type="button" className="se-btn se-btn-ghost" onClick={() => setStart(addDays(start, 7))} aria-label="Next week"><Icon name="arrow" size={16} /></button>
                {canWrite && <button type="button" className="se-btn se-btn-primary" onClick={openForm}><Icon name="calendar" size={16} /> Add shift</button>}
            </PageHeader>
            <div className="sa-filters">
                <SelectFilter label="Facility" value={fid ?? ''} onChange={setFacilityId} all="Choose facility" options={facilities.map((f) => ({ value: f.facilityId, label: f.name }))} />
            </div>

            {form && (
                <form className="sa-inline-form" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
                    <div className="se-panel-grid">
                        <label><span className="se-label">Staff member</span>
                            <div className="se-field"><select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required>
                                {[...people].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div></label>
                        <label><span className="se-label">Date</span><div className="se-input"><input type="date" min={todayIso()} value={form.shiftDate} onChange={(e) => setForm({ ...form, shiftDate: e.target.value })} required /></div></label>
                        <label><span className="se-label">Shift</span>
                            <div className="se-field"><select value={form.shiftType} onChange={(e) => { const t = e.target.value; setForm({ ...form, shiftType: t, startTime: TIMES[t][0], endTime: TIMES[t][1] }); }}>
                                {Object.keys(TIMES).map((t) => <option key={t} value={t}>{t}</option>)}</select></div></label>
                        <label><span className="se-label">Start – end</span>
                            <div className="sa-time-pair"><div className="se-input"><input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
                                <div className="se-input"><input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div></div></label>
                    </div>
                    {create.isError && <div className="se-alert" role="alert">{errorMessage(create.error)}</div>}
                    <div className="sa-form-actions">
                        <button type="button" className="se-btn se-btn-ghost" onClick={() => setForm(null)}>Cancel</button>
                        <button type="submit" className="se-btn se-btn-primary" disabled={create.isPending || !form.userId}>Save shift</button>
                    </div>
                </form>
            )}
            {remove.isError && <div className="se-alert" role="alert">{errorMessage(remove.error)}</div>}

            <div className="se-card se-table-wrap">
                <table className="se-table sa-roster">
                    <thead><tr><th>Staff</th>{days.map((d) => <th key={d} className={d === todayIso() ? 'hl' : ''}>{new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', timeZone: 'UTC' })}</th>)}</tr></thead>
                    <tbody>
                        {[...new Map(shifts.map((s) => [s.userId, s.userName]))].map(([userId, name]) => (
                            <tr key={userId}>
                                <td><span className="sa-person"><span className="se-avatar">{initials(name)}</span>{name}</span></td>
                                {days.map((d) => {
                                    const mine = shifts.filter((s) => s.userId === userId && s.shiftDate === d);
                                    return (
                                        <td key={d}>
                                            {mine.map((s) => (
                                                <div key={s.shiftId} className={`sa-shift ${s.shiftType}`}>
                                                    <strong>{s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}</strong>
                                                    <small>{tasks.filter((t) => t.shiftId === s.shiftId).length} tasks</small>
                                                    {canWrite && <button type="button" aria-label={`Remove ${name}'s shift on ${formatDate(d)}`} onClick={() => window.confirm('Remove this shift?') && remove.mutate(s.shiftId)}>×</button>}
                                                </div>
                                            ))}
                                            {!mine.length && <span className="sa-off">Off</span>}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        {!shifts.length && <tr><td colSpan={8} className="se-empty">No shifts this week.</td></tr>}
                    </tbody>
                </table>
            </div>
        </>
    );
}
