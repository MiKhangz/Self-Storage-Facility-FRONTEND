import { addDays, addMonths, todayIso } from '../../customer/components/format.js';

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
export const PRESETS = ['Today', 'Yesterday', 'Last 7 days', 'Last 30 days', 'This year', 'Custom range'];

/** 2026-04-22 → "Apr 22" (or "Apr 22, 2026" when `withYear` is true). */
export function formatShortDate(iso, withYear = false) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return `${MONTHS_SHORT[m - 1]} ${d}${withYear ? `, ${y}` : ''}`;
}

/** Trigger text: "Apr 22 – May 6", "Apr 22 – End" while picking an end date, or "Select dates" when empty. */
export function formatRangeLabel(range, anchor = null) {
    if (anchor) return `${formatShortDate(anchor)} – End`;
    if (!range?.from) return 'Select dates';
    const to = range.to || range.from;
    return `${formatShortDate(range.from)} – ${formatShortDate(to)}`;
}

/** Inclusive { from, to } in chronological order. */
export function orderRange(a, b) {
    if (!a) return { from: '', to: '' };
    if (!b || a <= b) return { from: a, to: b || a };
    return { from: b, to: a };
}

/** Preset range relative to `today` (YYYY-MM-DD). */
export function presetRange(name, today = todayIso()) {
    if (name === 'Today') return { from: today, to: today };
    if (name === 'Yesterday') { const y = addDays(today, -1); return { from: y, to: y }; }
    if (name === 'Last 7 days') return { from: addDays(today, -6), to: today };
    if (name === 'Last 30 days') return { from: addDays(today, -29), to: today };
    if (name === 'This year') return { from: `${today.slice(0, 4)}-01-01`, to: today };
    return null;
}

/** Which preset matches `range`, or "Custom range". */
export function activePreset(range, today = todayIso()) {
    if (!range?.from || !range?.to) return 'Custom range';
    for (const name of PRESETS.slice(0, -1)) {
        const p = presetRange(name, today);
        if (p.from === range.from && p.to === range.to) return name;
    }
    return 'Custom range';
}

/** First day of a month (YYYY-MM-01) shifted by N months. */
export const shiftMonth = (monthIso, delta) => `${addMonths(`${monthIso.slice(0, 7)}-01`, delta).slice(0, 7)}-01`;

/** Heading like "April 2026" for a month ISO (YYYY-MM-01). */
export function monthHeading(monthIso) {
    const [y, m] = monthIso.split('-').map(Number);
    return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** Weeks of a month (Monday-first), with null for blank leading and trailing cells. */
export function monthWeeks(monthIso) {
    const [y, m] = monthIso.slice(0, 7).split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const firstDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // 0 = Mo .. 6 = Su
    const cells = Array(firstDow).fill(null);
    for (let d = 1; d <= daysInMonth; d += 1) {
        cells.push(`${monthIso.slice(0, 7)}-${String(d).padStart(2, '0')}`);
    }
    while (cells.length % 7) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
}

/** Parses a single typed date like "Apr 28, 2026", "April 28 2026", "Apr 28", or "2026-04-28". */
export function parseTypedDate(input, defaultYear = Number(todayIso().slice(0, 4))) {
    const s = String(input ?? '').trim();
    if (!s) return null;
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
        const [, y, m, d] = iso.map(Number);
        const check = new Date(Date.UTC(y, m - 1, d));
        return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d ? s : null;
    }
    const named = s.match(/^([A-Za-z]+)\s+(\d{1,2})(?:[,\s]+(\d{4}))?$/);
    if (!named) return null;
    const mIdx = MONTHS_SHORT.findIndex((m) => m.toLowerCase() === named[1].slice(0, 3).toLowerCase());
    if (mIdx < 0) return null;
    const y = named[3] ? Number(named[3]) : defaultYear;
    const d = Number(named[2]);
    const check = new Date(Date.UTC(y, mIdx, d));
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mIdx || check.getUTCDate() !== d) return null;
    return `${String(y).padStart(4, '0')}-${String(mIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Parses either a single date ("Apr 28, 2026") or a range ("Apr 22 – May 6", "Apr 22, 2026 - May 6, 2026"). */
export function parseTypedInput(input, defaultYear = Number(todayIso().slice(0, 4))) {
    const s = String(input ?? '').trim();
    const parts = s.split(/\s*(?:–|—|\s-\s|to)\s*/i);
    if (parts.length === 2) {
        const a = parseTypedDate(parts[0], defaultYear);
        const b = parseTypedDate(parts[1], a ? Number(a.slice(0, 4)) : defaultYear);
        return a && b ? { type: 'range', ...orderRange(a, b) } : null;
    }
    const single = parseTypedDate(s, defaultYear);
    return single ? { type: 'date', date: single } : null;
}

/** Ensures `dateIso` is within the `count` visible months starting at `viewMonth`, shifting `viewMonth` if not. */
export function ensureVisibleMonth(viewMonth, dateIso, count = 2) {
    const target = `${dateIso.slice(0, 7)}-01`;
    const first = `${viewMonth.slice(0, 7)}-01`;
    const last = shiftMonth(first, count - 1);
    if (target < first) return target;
    if (target > last) return shiftMonth(target, -(count - 1));
    return first;
}

/** Keyboard navigation delta for an ISO date inside the calendar grid. */
export function moveDateByKey(dateIso, key, shiftKey = false) {
    if (key === 'ArrowLeft') return addDays(dateIso, -1);
    if (key === 'ArrowRight') return addDays(dateIso, 1);
    if (key === 'ArrowUp') return addDays(dateIso, -7);
    if (key === 'ArrowDown') return addDays(dateIso, 7);
    if (key === 'PageUp') return addMonths(dateIso, shiftKey ? -12 : -1);
    if (key === 'PageDown') return addMonths(dateIso, shiftKey ? 12 : 1);
    return null;
}

/** Checks whether a handover move-in date falls inside `range` (or due on/before today when `includeOverdueOnToday` is set). */
export function matchesHandoverRange(moveInDate, range, today = todayIso(), includeOverdueOnToday = true) {
    if (!range?.from) return true;
    const { from, to } = orderRange(range.from, range.to);
    if (includeOverdueOnToday && from === today && to === today) return moveInDate <= today;
    return moveInDate >= from && moveInDate <= to;
}
