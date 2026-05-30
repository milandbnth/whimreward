import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocate, cents, fmt, fmtSigned, prorateRent } from '../core/money.js';

test('allocate always sums back to the exact total, with integer parts', () => {
    /** @type {Array<[number, number[]]>} */
    const cases = [
        [10000, [1, 1, 1]],
        [99999, [3, 5, 7, 11]],
        [1, [1, 1, 1]],
        [0, [1, 1, 1]],
        [100000, [7, 2, 1]]
    ];
    for (const [total, weights] of cases) {
        const parts = allocate(total, weights);
        assert.equal(
            parts.reduce((s, x) => s + x, 0),
            total
        );
        assert.equal(parts.length, weights.length);
        assert.ok(parts.every(Number.isInteger));
    }
});

test('allocate splits an even total by largest remainder', () => {
    assert.deepEqual(allocate(10000, [1, 1, 1]), [3334, 3333, 3333]);
    assert.deepEqual(allocate(10000, [3, 1]), [7500, 2500]);
    assert.deepEqual(allocate(10000, []), []);
});

test('prorateRent rounds to the nearest cent and guards full/zero months', () => {
    assert.equal(prorateRent(210000, 22, 31), 149032);
    assert.equal(prorateRent(180000, 31, 31), 180000);
    assert.equal(prorateRent(180000, 31, 30), 180000);
    assert.equal(prorateRent(180000, 5, 0), 180000);
});

test('cents and formatters round-trip integer money', () => {
    assert.equal(cents(18), 1800);
    assert.equal(fmt(149032), '$1,490.32');
    assert.equal(fmt(-1800), '-$18.00');
    assert.equal(fmtSigned(1800), '+$18.00');
    assert.equal(fmtSigned(0), '$0.00');
});
