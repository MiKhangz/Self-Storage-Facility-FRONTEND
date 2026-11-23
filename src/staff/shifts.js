import { addDays } from '../customer/components/format.js';

/** Start and end of each kind of shift, Vietnam time; the night one ends the next day. */
export const TIMES = { Morning: ['07:00', '15:00'], Afternoon: ['15:00', '23:00'], Night: ['23:00', '07:00'] };

/**
 * What Add shift opens with: the first usual shift on `day` that has not started, since the API refuses one in the
 * past. `now` is HH:MM in Vietnam. A day gone by counts as today.
 */
export function nextShift(day, today, now) {
    let date = day < today ? today : day;
    let type = Object.keys(TIMES).find((t) => date > today || TIMES[t][0] > now);
    if (!type) [date, type] = [addDays(today, 1), 'Morning'];
    return { shiftDate: date, shiftType: type, startTime: TIMES[type][0], endTime: TIMES[type][1] };
}

/** The shifts of a day by start time, with the night shift of the day before while it runs on; `from` is HH:MM. */
export function shiftsOn(shifts, day) {
    const before = addDays(day, -1);
    return shifts
        .filter((s) => s.shiftDate === day || (s.shiftDate === before && s.endsNextDay && s.endTime > '00:00:00'))
        .map((s) => ({ ...s, from: s.shiftDate === day ? s.startTime.slice(0, 5) : '00:00' }))
        .sort((a, b) => a.from.localeCompare(b.from));
}

/** The weekly timetable: Monday first, and only the day shifts (no night). */
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const SLOT_TYPES = ['Morning', 'Afternoon'];
const cells = (days, shiftType) => days.map((day) => ({ day, shiftType }));
export const PRESETS = {
    'Full time Mon–Sat': cells(WEEKDAYS.slice(0, 6), 'Morning'),
    'Mon · Wed · Fri': cells(['Monday', 'Wednesday', 'Friday'], 'Morning'),
    Clear: [],
};

/** Ticks or unticks one cell of the timetable. */
export const toggleSlot = (slots, day, shiftType) =>
    slots.some((s) => s.day === day && s.shiftType === shiftType)
        ? slots.filter((s) => !(s.day === day && s.shiftType === shiftType))
        : [...slots, { day, shiftType }];
