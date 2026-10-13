const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

export const formatVnd = (amount) => (amount == null ? '—' : vnd.format(amount));

// en-CA formats as YYYY-MM-DD; toISOString would give yesterday's date before 07:00 in Vietnam.
export const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

/** Badge class and label for a count of free units. */
export function availability(count) {
    if (count == null) return null;
    if (count === 0) return { tone: 'none', label: 'Fully booked' };
    if (count <= 3) return { tone: 'low', label: `Only ${count} left` };
    return { tone: '', label: `${count} available` };
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

/** 2026-10-20 → 20/10/2026, without shifting the day through a time zone. */
export const formatDate = (isoDate) => (isoDate ? isoDate.slice(0, 10).split('-').reverse().join('/') : '—');
