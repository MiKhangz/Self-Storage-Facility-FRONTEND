import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shiftsApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { formatDate } from '../../customer/components/format.js';
import { PRESETS, SLOT_TYPES, TIMES, WEEKDAYS, toggleSlot } from '../shifts.js';
import { useT } from '../../i18n/I18n.jsx';

/**
 * A staff member's usual week at one facility: tick morning/afternoon per weekday. Saving rebuilds their shifts for
 * the next two weeks, and the hourly job keeps adding weeks after that.
 */
export default function Timetable({ facilityId, people, onClose }) {
    const tr = useT();
    const queryClient = useQueryClient();
    const [userId, setUserId] = useState(people[0]?.userId ?? '');
    const saved = useQuery({
        queryKey: ['timetable', userId, facilityId],
        queryFn: () => shiftsApi.getTimetable({ userId, facilityId }),
        enabled: !!userId && !!facilityId,
    });
    const [slots, setSlots] = useState([]);
    useEffect(() => { setSlots(saved.data?.slots ?? []); }, [saved.data]);
    const save = useMutation({
        mutationFn: () => shiftsApi.putTimetable({ userId: Number(userId), facilityId, slots }),
        onSuccess: (data) => {
            queryClient.setQueryData(['timetable', userId, facilityId], data);
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
        },
    });
    const ticked = (day, type) => slots.some((s) => s.day === day && s.shiftType === type);
    const pick = (id) => { setUserId(id); save.reset(); };

    return (
        <section className="sa-inline-form sa-timetable" aria-label={tr('Weekly timetable')}>
            <div className="sa-timetable-head">
                <label><span className="se-label">{tr('Staff member')}</span>
                    <div className="se-field"><select value={userId} onChange={(e) => pick(Number(e.target.value))}>
                        {!people.length && <option value="">{tr('No staff assigned')}</option>}
                        {people.map((p) => <option key={p.userId} value={p.userId}>{p.fullName}</option>)}</select></div></label>
                <div className="sa-timetable-presets">
                    {Object.entries(PRESETS).map(([name, cells]) => (
                        <button key={name} type="button" className="se-btn se-btn-ghost" onClick={() => setSlots(cells)}>{tr(name)}</button>
                    ))}
                </div>
            </div>

            <div className="se-table-wrap">
                <table className="se-table sa-timetable-grid">
                    <thead><tr><th>{tr('Shift')}</th>{WEEKDAYS.map((d) => <th key={d}>{tr(d.slice(0, 3))}</th>)}</tr></thead>
                    <tbody>
                        {SLOT_TYPES.map((type) => (
                            <tr key={type}>
                                <th scope="row">{tr(type)} <small>{TIMES[type][0]}–{TIMES[type][1]}</small></th>
                                {WEEKDAYS.map((day) => (
                                    <td key={day}>
                                        <label className={`sa-slot ${type}${ticked(day, type) ? ' on' : ''}`}>
                                            <input type="checkbox" checked={ticked(day, type)} disabled={!userId}
                                                onChange={() => { setSlots(toggleSlot(slots, day, type)); save.reset(); }}
                                                aria-label={tr('{shift} on {day}', { shift: tr(type), day: tr(day) })} />
                                            <span aria-hidden="true">{ticked(day, type) ? '✓' : ''}</span>
                                        </label>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="sa-timetable-note">
                {tr('{n} shifts a week · {h} hours', { n: slots.length, h: slots.length * 8 })}
                {saved.data?.through && <> · {tr('Shifts created up to {date}', { date: formatDate(saved.data.through) })}</>}
                <br /><small>{tr('Saving rebuilds this person’s shifts here for the next 2 weeks. Shifts changed by hand or with tasks are kept; a day off removed by hand comes back.')}</small>
            </p>
            {saved.isError && <div className="se-alert" role="alert">{errorMessage(saved.error)}</div>}
            {save.isError && <div className="se-alert" role="alert">{errorMessage(save.error)}</div>}
            {save.isSuccess && (
                <div className={`se-alert${save.data.skipped.length ? '' : ' info'}`} role="status">
                    {tr('Timetable saved.')}
                    {save.data.skipped.length > 0 && <> {tr('Not created:')}<ul>{save.data.skipped.map((s) => <li key={s}>{s}</li>)}</ul></>}
                </div>
            )}
            <div className="sa-form-actions">
                <button type="button" className="se-btn se-btn-ghost" onClick={onClose}>{tr('Close')}</button>
                <button type="button" className="se-btn se-btn-primary" disabled={!userId || save.isPending} onClick={() => save.mutate()}>{tr('Save timetable')}</button>
            </div>
        </section>
    );
}
