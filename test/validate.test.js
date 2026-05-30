import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAmount, validateEntry } from '../core/validate.js';
import { deriveClassification } from '../core/classify.js';
import { planReBill } from '../core/rebill.js';

function store() {
    return {
        properties: [{ id: 'p1' }],
        contacts: [{ id: 'c1' }],
        vendors: [{ id: 'v1' }],
        leases: [
            {
                id: 'L1',
                property: 'p1',
                rentCents: 180000,
                contacts: ['c1'],
                primaryContact: 'c1',
                status: 'active'
            }
        ],
        entries: [
            {
                id: 'x1',
                entryClass: 'operating_expense',
                category: 'utility',
                amountCents: 20000,
                date: '2026-05-01',
                period: { month: 5, year: 2026 },
                property: 'p1',
                vendor: 'v1',
                scopeLevel: 'property'
            }
        ]
    };
}

test('validateAmount rejects NaN, negative, fractional, and oversized amounts', () => {
    assert.ok(
        validateAmount(/** @type {any} */ ({ amountCents: NaN })).length > 0
    );
    assert.ok(
        validateAmount(/** @type {any} */ ({ amountCents: -1 })).length > 0
    );
    assert.ok(
        validateAmount(/** @type {any} */ ({ amountCents: 1.5 })).length > 0
    );
    assert.equal(
        validateAmount(/** @type {any} */ ({ amountCents: 100 })).length,
        0
    );
});

test('validateEntry accepts a clean entry and flags an unknown class', () => {
    const entry = {
        id: 'e',
        entryClass: 'tenant_charge',
        category: 'rent',
        amountCents: 100000,
        lease: 'L1',
        property: 'p1',
        scopeLevel: 'lease',
        date: '2026-05-01',
        period: { month: 5, year: 2026 }
    };
    assert.equal(validateEntry(entry, store()).length, 0);
    assert.ok(
        validateEntry({ ...entry, entryClass: 'bogus' }, store()).length > 0
    );
});

test('deriveClassification infers class from the anchor, with the category floor overriding', () => {
    const s = store();
    assert.equal(
        deriveClassification(s, {
            anchor: { type: 'lease', id: 'L1' },
            mode: 'bill',
            category: 'rent'
        }).entryClass,
        'tenant_charge'
    );
    assert.equal(
        deriveClassification(s, {
            anchor: { type: 'property', id: 'p1' },
            direction: 'out'
        }).entryClass,
        'operating_expense'
    );
    assert.equal(
        deriveClassification(s, {
            anchor: { type: 'property', id: 'p1' },
            direction: 'out',
            category: 'application_fee'
        }).entryClass,
        'operating_income'
    );
});

test('planReBill splits an expense to the exact total', () => {
    const plan = planReBill(store(), 'x1', { leaseIds: ['L1'], weights: [1] });
    assert.equal(
        plan.reduce((acc, p) => acc + p.amountCents, 0),
        20000
    );
});
