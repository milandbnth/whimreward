import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    chargeSettlement,
    dashboardOutstanding,
    depositLiability,
    leaseBalance,
    propertyPnL
} from '../core/fold.js';

/** A minimal store: one lease with a $1,800 rent charge, a $1,000 payment, and an $1,800 deposit collected. */
function store() {
    const party = [
        {
            contact: 'c1',
            role: 'tenant',
            nameSnapshot: 'Tenant One',
            viaLease: true
        }
    ];
    return {
        properties: [{ id: 'p1' }],
        contacts: [{ id: 'c1' }],
        vendors: [],
        leases: [
            {
                id: 'L1',
                property: 'p1',
                rentCents: 180000,
                contacts: ['c1'],
                primaryContact: 'c1',
                requiredSecurityDepositCents: 180000,
                status: 'active'
            }
        ],
        entries: [
            {
                id: 'e1',
                entryClass: 'tenant_charge',
                category: 'rent',
                amountCents: 180000,
                date: '2026-05-01',
                period: { month: 5, year: 2026 },
                lease: 'L1',
                property: 'p1',
                scopeLevel: 'lease',
                party
            },
            {
                id: 'e2',
                entryClass: 'tenant_payment',
                category: 'rent',
                amountCents: 100000,
                date: '2026-05-03',
                period: { month: 5, year: 2026 },
                lease: 'L1',
                property: 'p1',
                scopeLevel: 'lease',
                party
            },
            {
                id: 'e3',
                entryClass: 'deposit_movement',
                category: 'security_deposit',
                depositEffect: 'collect',
                amountCents: 180000,
                date: '2026-05-01',
                period: { month: 5, year: 2026 },
                lease: 'L1',
                property: 'p1',
                scopeLevel: 'lease',
                party: []
            }
        ]
    };
}

test('a lease balance is charges minus payments', () => {
    assert.equal(leaseBalance(store(), 'L1').closingCents, 80000);
});

test('the dashboard total reconciles to the sum of the tenant ledgers', () => {
    const s = store();
    const dash = dashboardOutstanding(s).totalCents;
    const sumOfLedgers = s.leases.reduce(
        (acc, l) => acc + Math.max(0, leaseBalance(s, l.id).closingCents),
        0
    );
    assert.equal(dash, sumOfLedgers);
    assert.equal(dash, 80000);
});

test('property P&L is cash-basis: the payment is income, the unpaid charge is not', () => {
    const pnl = propertyPnL(store(), 'p1', 2026);
    assert.equal(pnl.incomeTotalCents, 100000);
    assert.equal(pnl.expenseTotalCents, 0);
});

test('deposit liability folds from the deposit movements', () => {
    assert.equal(depositLiability(store(), 'L1'), 180000);
});

test('charge settlement reconciles: sum(open) - credit equals the lease closing', () => {
    const s = store();
    const settle = chargeSettlement(s, 'L1');
    assert.equal(settle.netCents, leaseBalance(s, 'L1').closingCents);
});

test('voiding an entry drops it from every fold at once', () => {
    const s = store();
    const payment = s.entries.find((e) => e.id === 'e2');
    payment.deletedAt = '2026-05-10';
    assert.equal(leaseBalance(s, 'L1').closingCents, 180000);
    assert.equal(propertyPnL(s, 'p1', 2026).incomeTotalCents, 0);
    assert.equal(depositLiability(s, 'L1'), 180000);
});
