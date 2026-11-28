const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

export const formatVnd = (amount) => (amount == null ? '—' : vnd.format(amount));

// en-CA formats as YYYY-MM-DD; toISOString would give yesterday's date before 07:00 in Vietnam.
export const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

/** Current HH:mm in Vietnam time (24-hour clock). */
export const vietnamTimeHhMm = () =>
    new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' });

/** Same-day move-in bookings close at 20:00 Vietnam time. */
export const isSameDayClosed = () => vietnamTimeHhMm() >= '20:00';

/** Badge class and label for a count of free units; `tr` is the screen's t() (Vietnamese without it). */
export function availability(count, tr = (text, vars) => text.replace('{count}', vars?.count)) {
    if (count == null) return null;
    if (count === 0) return { tone: 'none', label: tr('Đã hết kho') };
    if (count <= 3) return { tone: 'low', label: tr('Chỉ còn {count} kho', { count }) };
    return { tone: '', label: tr('Còn {count} kho', { count }) };
}

/** Date + N months, clamping 31 Jan + 1 month to 28/29 Feb like .NET DateOnly.AddMonths. */
export function addMonths(isoDate, months) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

/** Date + N days (N may be negative). */
export function addDays(isoDate, days) {
    const d = new Date(`${isoDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

/** Last day of a rental: move-in + N months − 1 day. */
export function rentalEndDate(isoDate, months) {
    return addDays(addMonths(isoDate, months), -1);
}

/** The end date a renewal gives, as the API works it out: whole billing months counted from the start date. */
export function renewedEndDate(start, end, months) {
    let billed = 0;
    while (addMonths(start, billed) <= end) billed++;
    return rentalEndDate(start, billed + months);
}

const DEPOSIT_HOLD_HOURS = 24; // ReservationService.DepositHoldHours on the API

/** When an unpaid booking lets its unit go: 24 hours after booking, or when move-in day ends if that is sooner. */
export function depositDeadline(createdAt, moveInDate, sameDay = false) {
    if (sameDay) return new Date(`${moveInDate}T20:30:00+07:00`).toISOString();
    const held = Date.parse(createdAt) + DEPOSIT_HOLD_HOURS * 3_600_000;
    return new Date(Math.min(held, Date.parse(`${moveInDate}T23:59:00+07:00`))).toISOString();
}

/**
 * The Vietnam calendar day, as YYYY-MM-DD, of what the API sends: a date stays as it is; a moment is UTC, with or
 * without its Z, and before 07:00 in Vietnam its UTC day is still the day before.
 */
export function vietnamDay(iso) {
    if (iso.length <= 10) return iso;
    const moment = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`);
    return moment.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

/** A date or a UTC moment as its day in Vietnam: 2026-10-20 → 20/10/2026. */
export const formatDate = (iso) => (iso ? vietnamDay(iso).split('-').reverse().join('/') : '—');
