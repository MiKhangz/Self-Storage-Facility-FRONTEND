import test from 'node:test';
import assert from 'node:assert/strict';
import {
    activePreset, ensureVisibleMonth, formatRangeLabel, matchesHandoverRange,
    monthWeeks, moveDateByKey, orderRange, parseTypedInput, presetRange,
} from '../src/staff/components/dateRange.js';

test('demo acceptance: April/May 2026 range formatting, Monday-first grid segments, and presets on May 14, 2026', () => {
    const today = '2026-05-14';
    const demo = { from: '2026-04-22', to: '2026-05-06' };
    assert.equal(formatRangeLabel(demo), 'Apr 22 – May 6');
    assert.equal(formatRangeLabel(demo, '2026-04-22'), 'Apr 22 – End');
    assert.equal(formatRangeLabel(null), 'Select dates');
    assert.equal(activePreset(demo, today), 'Custom range');

    // Inclusive presets relative to May 14, 2026
    assert.deepEqual(presetRange('Today', today), { from: '2026-05-14', to: '2026-05-14' });
    assert.deepEqual(presetRange('Yesterday', today), { from: '2026-05-13', to: '2026-05-13' });
    assert.deepEqual(presetRange('Last 7 days', today), { from: '2026-05-08', to: '2026-05-14' });
    assert.deepEqual(presetRange('Last 30 days', today), { from: '2026-04-15', to: '2026-05-14' });
    assert.deepEqual(presetRange('This year', today), { from: '2026-01-01', to: '2026-05-14' });
    assert.equal(activePreset({ from: '2026-05-08', to: '2026-05-14' }, today), 'Last 7 days');

    // Mint band segments across April and May 2026: Apr 22–26, Apr 27–30, May 1–3, May 4–6
    const inDemo = (w) => w.filter((d) => d && d >= demo.from && d <= demo.to);
    const aprSegments = monthWeeks('2026-04-01').map(inDemo).filter((s) => s.length);
    const maySegments = monthWeeks('2026-05-01').map(inDemo).filter((s) => s.length);
    assert.deepEqual(aprSegments.map((s) => [s[0], s.at(-1)]), [
        ['2026-04-22', '2026-04-26'],
        ['2026-04-27', '2026-04-30'],
    ]);
    assert.deepEqual(maySegments.map((s) => [s[0], s.at(-1)]), [
        ['2026-05-01', '2026-05-03'],
        ['2026-05-04', '2026-05-06'],
    ]);
});

test('chronological ordering, typed date parsing, keyboard navigation and handover range matching', () => {
    assert.deepEqual(orderRange('2026-05-06', '2026-04-22'), { from: '2026-04-22', to: '2026-05-06' });
    assert.deepEqual(parseTypedInput('Apr 28, 2026', 2026), { type: 'date', date: '2026-04-28' });
    assert.deepEqual(parseTypedInput('Apr 22 – May 6', 2026), { type: 'range', from: '2026-04-22', to: '2026-05-06' });
    assert.equal(parseTypedInput('Feb 30, 2026', 2026), null);

    assert.equal(moveDateByKey('2026-04-22', 'ArrowRight'), '2026-04-23');
    assert.equal(moveDateByKey('2026-04-22', 'ArrowDown'), '2026-04-29');
    assert.equal(moveDateByKey('2026-04-22', 'PageDown', false), '2026-05-22');
    assert.equal(moveDateByKey('2026-04-22', 'PageUp', true), '2025-04-22');
    assert.equal(ensureVisibleMonth('2026-04-01', '2026-06-10', 2), '2026-05-01');
    assert.equal(ensureVisibleMonth('2026-04-01', '2026-06-10', 3), '2026-04-01');

    // Default today view shows due-today and overdue handovers; past or custom range filters strictly
    assert.equal(matchesHandoverRange('2026-05-10', { from: '2026-05-14', to: '2026-05-14' }, '2026-05-14'), true);
    assert.equal(matchesHandoverRange('2026-05-14', { from: '2026-05-14', to: '2026-05-14' }, '2026-05-14'), true);
    assert.equal(matchesHandoverRange('2026-05-15', { from: '2026-05-14', to: '2026-05-14' }, '2026-05-14'), false);
    assert.equal(matchesHandoverRange('2026-05-10', { from: '2026-05-10', to: '2026-05-12' }, '2026-05-14'), true);
    assert.equal(matchesHandoverRange('2026-05-14', { from: '2026-05-10', to: '2026-05-12' }, '2026-05-14'), false);
});
