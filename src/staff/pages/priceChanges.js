/**
 * What changed from one price version to the next, as plain rows the history can show:
 * { code, note, changes: [{ key, label, unit, from, to }] }. Units: 'vnd', '%', or a word such as 'days'.
 */

export const PRICE_FIELDS = [
    ['basePricePerMonth', 'Price', 'vnd'],
    ['discount3Month', '3+ months', '%'],
    ['discount6Month', '6+ months', '%'],
    ['discount12Month', '12+ months', '%'],
];

const num = (v) => (v == null ? null : Number(v));

/** The fields whose value differs between two records; a missing record counts as no value. */
export function fieldChanges(before, after, fields) {
    return fields
        .filter(([k]) => num(before?.[k]) !== num(after?.[k]))
        .map(([key, label, unit]) => ({ key, label, unit, from: num(before?.[key]), to: num(after?.[key]) }));
}

/** Percent change between two amounts, one decimal (650 from 600 is 8.3); null when there is no old amount. */
export const percentChange = (from, to) => (from ? Math.round(((to - from) / from) * 1000) / 10 : null);

/** Rows for items matched by key across two versions: added, removed, or changed (compare(old, now) lists how). */
function itemChanges(before, after, key, compare, { added, removed }, codeOf) {
    const b = new Map((before ?? []).map((x) => [x[key], x]));
    const a = new Map((after ?? []).map((x) => [x[key], x]));
    return [...new Set([...b.keys(), ...a.keys()])]
        .map((id) => {
            const old = b.get(id);
            const now = a.get(id);
            return { code: codeOf(now ?? old), note: !old ? added : !now ? removed : null, changes: compare(old, now) };
        })
        .filter((r) => r.note || r.changes.length)
        .sort((x, y) => x.code.localeCompare(y.code));
}

/**
 * A facility version against the version before it. A size it starts pricing, or gives back, is compared with the
 * company standard price.
 * shortcut: the standard is today's, not the one in force back then; fine while the standard rarely changes.
 */
export function facilityVersionChanges(version, previous, standard) {
    const std = new Map((standard ?? []).map((s) => [s.unitTypeId, s]));
    return itemChanges(previous?.prices, version.prices, 'unitTypeId',
        (old, now) => fieldChanges(old ?? std.get(now.unitTypeId), now ?? std.get(old.unitTypeId), PRICE_FIELDS),
        { added: 'Now own price, was the company standard', removed: 'Back to the company standard' }, (p) => p.unitTypeCode);
}

/** A company standard version against the one before it: size prices, rental rules, and extra fees. */
export function policyChanges(policy, previous, ruleFields) {
    return {
        sizes: itemChanges(previous?.unitPrices, policy.unitPrices, 'unitTypeId', (old, now) => fieldChanges(old, now, PRICE_FIELDS),
            { added: 'New size', removed: 'Size removed' }, (p) => p.unitTypeCode),
        rules: fieldChanges(previous, policy, ruleFields),
        fees: itemChanges(previous?.fees, policy.fees, 'code',
            (old, now) => fieldChanges(old, now, [['amount', 'Amount', (now ?? old).isPercentage ? '%' : 'vnd']]),
            { added: 'New fee', removed: 'Fee removed' }, (f) => f.name),
    };
}
