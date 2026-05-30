/**
 * Re-bill — recover an operating expense from tenants as linked passthrough charges.
 * A passthrough is modeled as ordinary tenant_charge lines (one per lease) carrying `reBilledFrom`. Because
 * a tenant_charge has no P&L effect, no income is double-recognized; income lands only when the tenant pays,
 * exactly like rent. `planReBill` is pure — it returns a split that always sums to the exact total — and the
 * caller turns the plan into real ledger lines.
 *
 * @module core/rebill
 */

import { allocate } from './money.js';
import { liveEntries } from './fold.js';

/** The category every re-billed passthrough charge carries. */
export const REBILL_CATEGORY = 'reimbursement';

/**
 * The live passthrough charges that were re-billed from one expense.
 *
 * @param {import('./types.js').LedgerStore} store
 * @param {string} expenseId
 * @returns {import('./types.js').LedgerEntry[]}
 */
export function reBillCharges(store, expenseId) {
    return liveEntries(store).filter(
        (e) => e.entryClass === 'tenant_charge' && e.reBilledFrom === expenseId
    );
}

/**
 * Reconcile a re-bill: how much of an expense has been recovered from tenants versus absorbed by the owner.
 *
 * @param {import('./types.js').LedgerStore} store
 * @param {string} expenseId
 * @returns {{ expenseId: string, expenseCents: number, recoveredCents: number, absorbedCents: number, overRecoveredCents: number, chargeIds: string[], count: number }}
 */
export function reBillSummary(store, expenseId) {
    const exp = store.entries.find((e) => e.id === expenseId);
    const charges = reBillCharges(store, expenseId);
    const recoveredCents = charges.reduce((s, e) => s + e.amountCents, 0);
    const expenseCents = exp ? exp.amountCents : 0;
    return {
        expenseId,
        expenseCents,
        recoveredCents,
        absorbedCents: Math.max(0, expenseCents - recoveredCents),
        overRecoveredCents: Math.max(0, recoveredCents - expenseCents),
        chargeIds: charges.map((e) => e.id),
        count: charges.length
    };
}

/**
 * Whether an entry can be re-billed — an operating expense on a property that has at least one active lease.
 *
 * @param {import('./types.js').LedgerStore} store
 * @param {import('./types.js').LedgerEntry} entry
 * @returns {boolean}
 */
export function reBillEligible(store, entry) {
    return !!(
        entry &&
        entry.entryClass === 'operating_expense' &&
        entry.property &&
        store.leases.some(
            (l) => l.property === entry.property && l.status === 'active'
        )
    );
}

/**
 * Plan a re-bill: split an expense into one passthrough amount per target lease, using the exact-sum
 * `allocate` primitive so the parts always sum back to the total. Returns the split only — the caller
 * commits the resulting ledger lines.
 *
 * @param {import('./types.js').LedgerStore} store
 * @param {string} expenseId
 * @param {{ leaseIds?: string[], weights?: number[], totalCents?: number }} [opts]
 * @returns {Array<{ lease: string, amountCents: number }>}
 */
export function planReBill(store, expenseId, opts) {
    opts = opts || {};
    const exp = store.entries.find((e) => e.id === expenseId);
    if (!exp) throw new Error('planReBill: no expense "' + expenseId + '"');
    if (exp.entryClass !== 'operating_expense')
        throw new Error('planReBill: source must be an operating_expense');
    if (!exp.property)
        throw new Error(
            'planReBill: expense has no property to attribute the passthrough'
        );
    const leaseIds =
        opts.leaseIds && opts.leaseIds.length
            ? opts.leaseIds
            : store.leases
                  .filter(
                      (l) =>
                          l.property === exp.property && l.status === 'active'
                  )
                  .map((l) => l.id);
    if (!leaseIds.length)
        throw new Error('planReBill: no active target leases on the property');
    const totalCents =
        opts.totalCents != null ? opts.totalCents : exp.amountCents;
    const weights =
        opts.weights && opts.weights.length === leaseIds.length
            ? opts.weights
            : leaseIds.map(() => 1);
    const parts = allocate(totalCents, weights);
    return leaseIds.map((lease, i) => ({ lease, amountCents: parts[i] }));
}
