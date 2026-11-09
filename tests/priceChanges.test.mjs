import test from 'node:test';
import assert from 'node:assert/strict';
import { facilityVersionChanges, percentChange, policyChanges } from '../src/staff/pages/priceChanges.js';

const price = (unitTypeId, unitTypeCode, basePricePerMonth, discount3Month = 5) =>
    ({ unitTypeId, unitTypeCode, basePricePerMonth, discount3Month, discount6Month: 10, discount12Month: 10 });
const standard = [price(1, 'S5', 500_000), price(2, 'M10', 2_000_000)];

test('a facility version lists changed numbers, sizes it starts pricing and sizes it gives back', () => {
    const v1 = { prices: [price(1, 'S5', 600_000)] };
    const v2 = { prices: [price(1, 'S5', 650_000, 7), price(2, 'M10', 1_900_000)] };
    assert.deepEqual(facilityVersionChanges(v2, v1, standard), [
        { code: 'M10', note: 'Now own price, was the company standard', changes: [{ key: 'basePricePerMonth', label: 'Price', unit: 'vnd', from: 2_000_000, to: 1_900_000 }] },
        { code: 'S5', note: null, changes: [
            { key: 'basePricePerMonth', label: 'Price', unit: 'vnd', from: 600_000, to: 650_000 },
            { key: 'discount3Month', label: '3+ months', unit: '%', from: 5, to: 7 },
        ] },
    ]);
    const v3 = { prices: [price(2, 'M10', 1_900_000)] };
    assert.deepEqual(facilityVersionChanges(v3, v2, standard)[0].note, 'Back to the company standard');
    // The first version is compared with the company standard.
    assert.equal(facilityVersionChanges(v1, null, standard)[0].changes[0].from, 500_000);
});

test('a company standard version lists price, rule and fee changes; untouched ones stay out', () => {
    const rules = [['graceDays', 'Grace period', 'days'], ['lateFeePercentPerWeek', 'Late fee', '% / week']];
    const v1 = { graceDays: 5, lateFeePercentPerWeek: 2, unitPrices: standard, fees: [{ code: 'LOCK', name: 'Lock', amount: 50_000, isPercentage: false }] };
    const v2 = { graceDays: 7, lateFeePercentPerWeek: 2, unitPrices: [standard[0]], fees: [] };
    const c = policyChanges(v2, v1, rules);
    assert.deepEqual(c.rules, [{ key: 'graceDays', label: 'Grace period', unit: 'days', from: 5, to: 7 }]);
    assert.deepEqual(c.sizes.map((s) => [s.code, s.note]), [['M10', 'Size removed']]);
    assert.deepEqual(c.fees.map((f) => [f.code, f.note]), [['Lock', 'Fee removed']]);
});

test('percent change is rounded to one decimal and needs an old amount', () => {
    assert.equal(percentChange(600_000, 650_000), 8.3);
    assert.equal(percentChange(2_000_000, 1_900_000), -5);
    assert.equal(percentChange(null, 1), null);
});
