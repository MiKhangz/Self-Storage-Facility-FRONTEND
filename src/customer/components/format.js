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
