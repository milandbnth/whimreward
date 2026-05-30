/**
 * The fold — the single source of truth for every derived figure.
 * A balance, status, P&L line, deposit liability, dashboard total, and contact feed are all deterministic
 * folds over the same append-only ledger. There are no parallel sources of truth: change one entry and
 * every figure recomputes from it. All functions are pure and read only non-deleted entries.
 *
 * @module core/fold
 */

import { arDelta, cashDelta, depositDelta, pnlDelta } from './taxonomy.js';
import { periodCmp, periodKey } from './period.js';

const AR_CLASSES = [
    'tenant_charge',
    'tenant_payment',
    'tenant_refund',
    'deposit_application'
];

/**
 * The live ledger view — every non-deleted entry. This is the SOLE place deletion is read; every other
 * fold reads through it, so a voided or trashed line is excluded from all derived figures at once.
 *
 * @param {import('./types.js').LedgerStore} store
 * @returns {import('./types.js').LedgerEntry[]}
 */
export function liveEntries(store) {
    return store.entries.filter((e) => !e.deletedAt);
}

/**
 * Replay one lease's receivable ledger into per-period projection rows, with cross-period netting so an
 * overpayment carries forward as a negative opening balance. This is the ONLY producer of a lease balance.
 *
 * @param {import('./types.js').LedgerStore} store
 * @param {string} leaseId
 * @returns {import('./types.js').LeaseProjection[]}
 */
export function replayLeaseLedger(store, leaseId) {
    const lease = store.leases.find((l) => l.id === leaseId);
    const rows = liveEntries(store).filter(
        (e) => e.lease === leaseId && AR_CLASSES.includes(e.entryClass)
    );
    if (!rows.length && !lease) return [];

    const byPeriod = new Map();
    for (const e of rows) {
        const k = periodKey(e.period);
        if (!byPeriod.has(k))
            byPeriod.set(k, {
                period: e.period,
                charges: 0,
                payments: 0,
                entries: []
            });
        const b = byPeriod.get(k);
        if (arDelta(e) > 0) b.charges += e.amountCents;
        else b.payments += -arDelta(e);
        b.entries.push(e);
    }
    if (!byPeriod.size) return [];

    const periods = [...byPeriod.values()].sort((a, b) =>
        periodCmp(a.period, b.period)
    );
    let opening = 0;
    const projections = [];
    for (const b of periods) {
        const totalOwed = opening + b.charges;
        const closing = totalOwed - b.payments;
        let status;
        if (b.charges === 0 && b.payments === 0) status = null;
        else if (closing <= 0) status = 'Paid';
        else if (b.payments > 0 || opening < 0) status = 'Partial';
        else status = 'Unpaid';
        projections.push({
            lease: leaseId,
            property: lease ? lease.property : null,
            period: b.period,
            chargesCents: b.charges,
            paymentsCents: b.payments,
            openingCents: opening,
            totalOwedCents: totalOwed,
            closingCents: closing,
            balanceCents: closing,
            creditCents: closing < 0 ? -closing : 0,
            status,
            entryIds: b.entries.map((e) => e.id)
        });
        opening = closing;
    }
    return projections;
}

/**
 * The balance at a lease's latest projected period — what this tenant owes now. The dashboard total and
 * the tenant ledger header both read this same function, so the two can never diverge.
 *
 * @param {import('./types.js').LedgerStore} store
 * @param {string} leaseId
 * @returns {import('./types.js').LeaseBalance}
 */
export function leaseBalance(store, leaseId) {
    const proj = replayLeaseLedger(store, leaseId);
    if (!proj.length)
        return {
            closingCents: 0,
            creditCents: 0,
            latestPeriod: null,
            status: null
        };
    const last = proj[proj.length - 1];
    return {
        closingCents: last.closingCents,
        creditCents: last.creditCents,
        latestPeriod: last.period,
        status: last.status
    };
}

/**
 * Total receivable outstanding across the portfolio — the sum, over every lease (active or terminated with
 * a balance), of max(0, latest closing). Uses the same selection rule as the tenant ledger, so the
 * dashboard figure always reconciles to the sum of the ledgers.
 *
 * @param {import('./types.js').LedgerStore} store
 * @returns {{ totalCents: number, perLease: Array<{ lease: import('./types.js').Lease, owedCents: number, creditCents: number, latestPeriod: import('./types.js').Period | null }> }}
 */
export function dashboardOutstanding(store) {
    let total = 0;
    const perLease = [];
    for (const l of store.leases) {
        const b = leaseBalance(store, l.id);
        const owed = Math.max(0, b.closingCents);
        if (owed !== 0 || b.creditCents !== 0)
            perLease.push({
                lease: l,
                owedCents: owed,
                creditCents: b.creditCents,
                latestPeriod: b.latestPeriod
            });
        total += owed;
    }
    return { totalCents: total, perLease };
}

/**
 * Receivable outstanding for a single property — the sum of max(0, latest closing) over its leases.
 *
 * @param {import('./types.js').LedgerStore} store
 * @param {string} propertyId
 * @returns {number}
 */
export function propertyOutstanding(store, propertyId) {
    let total = 0;
    for (const l of store.leases.filter((l) => l.property === propertyId))
        total += Math.max(0, leaseBalance(store, l.id).closingCents);
    return total;
}

/**
 * Cash-basis profit and loss for one property in one year, grouped by category. Income is the sum of
 * pnl:income deltas, expense the sum of pnl:expense deltas; accounts receivable is never summed in.
 *
 * @param {import('./types.js').LedgerStore} store
 * @param {string} propertyId
 * @param {number} year
 * @returns {{ income: Object<string, number>, expense: Object<string, number>, incomeTotalCents: number, expenseTotalCents: number, netCents: number }}
 */
export function propertyPnL(store, propertyId, year) {
    const rows = liveEntries(store).filter(
        (e) => e.property === propertyId && e.period.year === year
    );
    /** @type {Record<string, number>} */
    const income = {};
    /** @type {Record<string, number>} */
    const expense = {};
    let incomeTotal = 0;
    let expenseTotal = 0;
    for (const e of rows) {
        const p = pnlDelta(e);
        if (p === 0) continue;
        if (p > 0) {
            income[e.category] = (income[e.category] || 0) + p;
            incomeTotal += p;
        } else {
            expense[e.category] = (expense[e.category] || 0) + -p;
            expenseTotal += -p;
        }
    }
    return {
        income,
        expense,
        incomeTotalCents: incomeTotal,
        expenseTotalCents: expenseTotal,
        netCents: incomeTotal - expenseTotal
    };
}

/**
 * Cash-basis profit and loss across the whole portfolio, optionally filtered to one year.
 *
 * @param {import('./types.js').LedgerStore} store
 * @param {number} [year]
 * @returns {{ incomeCents: number, expenseCents: number, netCents: number }}
 */
export function portfolioPnL(store, year) {
    let income = 0;
    let expense = 0;
    for (const e of liveEntries(store)) {
        if (year && e.period.year !== year) continue;
        const p = pnlDelta(e);
        if (p > 0) income += p;
        else expense += -p;
    }
    return {
        incomeCents: income,
        expenseCents: expense,
        netCents: income - expense
    };
}

/**
 * The deposit liability held for one lease — the running sum of its signed deposit deltas.
 *
 * @param {import('./types.js').LedgerStore} store
 * @param {string} leaseId
 * @returns {number}
 */
export function depositLiability(store, leaseId) {
    return liveEntries(store)
        .filter(
            (e) =>
                e.lease === leaseId &&
                (e.entryClass === 'deposit_movement' ||
                    e.entryClass === 'deposit_application')
        )
        .reduce((s, e) => s + depositDelta(e), 0);
}

/**
 * The deposit status for a lease, comparing the amount held against the amount required.
 *
 * @param {import('./types.js').LedgerStore} store
 * @param {import('./types.js').Lease} lease
 * @returns {'held' | 'partially_returned' | 'returned' | 'forfeit' | 'none'}
 */
export function depositStatus(store, lease) {
    const held = depositLiability(store, lease.id);
    const required =
        (lease.requiredSecurityDepositCents || 0) +
        (lease.requiredPetDepositCents || 0);
    const forfeited =
        liveEntries(store).some(
            (e) =>
                e.lease === lease.id &&
                e.entryClass === 'deposit_movement' &&
                e.depositEffect === 'forfeit'
        ) ||
        liveEntries(store).some(
            (e) =>
                e.lease === lease.id && e.entryClass === 'deposit_application'
        );
    if (held <= 0 && forfeited) return 'forfeit';
    if (held <= 0) return required > 0 ? 'returned' : 'none';
    if (held < required) return 'partially_returned';
    return 'held';
}

/**
 * The deposit register — one row per lease that has a required or held deposit, with its status.
 *
 * @param {import('./types.js').LedgerStore} store
 * @returns {Array<{ lease: import('./types.js').Lease, requiredCents: number, heldCents: number, status: string }>}
 */
export function depositRegister(store) {
    return store.leases
        .map((l) => {
            const required =
                (l.requiredSecurityDepositCents || 0) +
                (l.requiredPetDepositCents || 0);
            return {
                lease: l,
                requiredCents: required,
                heldCents: depositLiability(store, l.id),
                status: depositStatus(store, l)
            };
        })
        .filter((r) => r.requiredCents > 0 || r.heldCents !== 0);
}

/**
 * The total deposit liability held across every lease in the portfolio.
 *
 * @param {import('./types.js').LedgerStore} store
 * @returns {number}
 */
export function totalDepositLiability(store) {
    return store.leases.reduce((s, l) => s + depositLiability(store, l.id), 0);
}

/**
 * A contact's participation feed — every entry the contact is a party to, newest first. This is a list,
 * never a balance: on a joint-and-several lease the obligation belongs to the lease, not the person.
 *
 * @param {import('./types.js').LedgerStore} store
 * @param {string} contactId
 * @returns {import('./types.js').LedgerEntry[]}
 */
export function contactFeed(store, contactId) {
    return liveEntries(store)
        .filter((e) => (e.party || []).some((p) => p.contact === contactId))
        .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

/**
 * The portfolio cash view — every live entry, newest first, optionally filtered by class, property,
 * scope, or year.
 *
 * @param {import('./types.js').LedgerStore} store
 * @param {{ entryClass?: string, propertyId?: string, scopeLevel?: string, year?: number }} [filters]
 * @returns {import('./types.js').LedgerEntry[]}
 */
export function portfolio(store, filters) {
    let rows = liveEntries(store);
    if (filters) {
        if (filters.entryClass)
            rows = rows.filter((e) => e.entryClass === filters.entryClass);
        if (filters.propertyId)
            rows = rows.filter((e) => e.property === filters.propertyId);
        if (filters.scopeLevel)
            rows = rows.filter((e) => e.scopeLevel === filters.scopeLevel);
        if (filters.year)
            rows = rows.filter((e) => e.period.year === filters.year);
    }
    return rows.sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

const settlementOrder = (a, b) =>
    +new Date(a.date) - +new Date(b.date) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * The per-charge settlement view of a lease's receivable. The balance is and stays the period fold; an
 * allocation hint on a payment only redistributes which charge a dollar lands on, never the total. The
 * reconciliation contract it always satisfies: `sum(open) - credit === leaseBalance.closing`.
 *
 * @param {import('./types.js').LedgerStore} store
 * @param {string} leaseId
 * @returns {{ items: Array<object>, creditCents: number, netCents: number, openCents: number, warnings: Array<object> }}
 */
export function chargeSettlement(store, leaseId) {
    const rows = liveEntries(store).filter(
        (e) => e.lease === leaseId && AR_CLASSES.includes(e.entryClass)
    );
    const charges = rows
        .filter((e) => arDelta(e) > 0)
        .sort(settlementOrder)
        .map((e) => ({
            id: e.id,
            entryClass: e.entryClass,
            category: e.category,
            date: e.date,
            period: e.period,
            chargedCents: arDelta(e),
            paidCents: 0,
            applications: []
        }));
    const payments = rows.filter((e) => arDelta(e) < 0).sort(settlementOrder);
    const byId = new Map(charges.map((c) => [c.id, c]));
    let creditCents = 0;
    const warnings = [];

    for (const p of payments) {
        let remaining = -arDelta(p);
        const applyTo = (charge, amt, targeted) => {
            const use = Math.min(charge.chargedCents - charge.paidCents, amt);
            if (use <= 0) return 0;
            charge.paidCents += use;
            charge.applications.push({
                payment: p.id,
                amountCents: use,
                targeted
            });
            return use;
        };
        if (Array.isArray(p.allocations) && p.allocations.length) {
            for (const a of p.allocations) {
                const c = byId.get(a.charge);
                if (!c) {
                    warnings.push({
                        payment: p.id,
                        charge: a.charge,
                        issue: 'allocation target is not an open charge on this lease'
                    });
                    continue;
                }
                remaining -= applyTo(
                    c,
                    Math.min(a.amountCents, remaining),
                    true
                );
            }
        }
        for (const c of charges) {
            if (remaining <= 0) break;
            remaining -= applyTo(c, remaining, false);
        }
        if (remaining > 0) creditCents += remaining;
    }

    const items = charges.map((c) => ({
        ...c,
        openCents: c.chargedCents - c.paidCents,
        settled: c.chargedCents - c.paidCents <= 0
    }));
    const openCents = items.reduce((s, c) => s + c.openCents, 0);
    return {
        items,
        creditCents,
        netCents: openCents - creditCents,
        openCents,
        warnings
    };
}
