/**
 * The financial-class taxonomy and the per-entry deltas it derives.
 * `entryClass` is the SOLE classifier; `category` is descriptive only. Cash, P&L, AR, and deposit effects
 * are derived from the class at fold time and never stored, so no bulk write can desync a persisted sign.
 *
 * @module core/taxonomy
 */

/**
 * The seven financial classes. Each maps a class to its cash, P&L, accounts-receivable, and deposit
 * effects. `flex` means the effect depends on a sub-discriminator (see DEPOSIT_EFFECT).
 */
export const CLASS_SEMANTICS = Object.freeze({
    operating_income: {
        label: 'Operating income',
        cash: 'in',
        pnl: 'income',
        ar: 'none',
        deposit: 'none',
        leaseRequired: false,
        color: 'green'
    },
    operating_expense: {
        label: 'Operating expense',
        cash: 'out',
        pnl: 'expense',
        ar: 'none',
        deposit: 'none',
        leaseRequired: false,
        color: 'red'
    },
    tenant_charge: {
        label: 'Tenant charge',
        cash: 'none',
        pnl: 'none',
        ar: 'increase',
        deposit: 'none',
        leaseRequired: true,
        color: 'amber'
    },
    tenant_payment: {
        label: 'Tenant payment',
        cash: 'in',
        pnl: 'income',
        ar: 'decrease',
        deposit: 'none',
        leaseRequired: true,
        color: 'green'
    },
    tenant_refund: {
        label: 'Tenant refund',
        cash: 'out',
        pnl: 'none',
        ar: 'increase',
        deposit: 'none',
        leaseRequired: true,
        color: 'red'
    },
    deposit_movement: {
        label: 'Deposit movement',
        cash: 'flex',
        pnl: 'none',
        ar: 'none',
        deposit: 'flex',
        leaseRequired: true,
        color: 'violet'
    },
    deposit_application: {
        label: 'Deposit applied',
        cash: 'none',
        pnl: 'income',
        ar: 'decrease',
        deposit: 'decrease',
        leaseRequired: true,
        color: 'violet'
    }
});

/**
 * Per-effect semantics for deposit_movement — the only class whose effects depend on a sub-discriminator.
 * A held deposit is recognized as income exactly once: at forfeit (kept for damages) or at application
 * (applied to a receivable). Collecting and returning a deposit never touch P&L.
 */
export const DEPOSIT_EFFECT = Object.freeze({
    collect: { cash: 'in', deposit: 'increase', pnl: 'none' },
    return: { cash: 'out', deposit: 'decrease', pnl: 'none' },
    forfeit: { cash: 'none', deposit: 'decrease', pnl: 'income' }
});

/**
 * Categories whose economic class is intrinsic and overrides the anchor default — for example a kept
 * application fee is operating_income even when entered under a tenant anchor.
 */
export const CATEGORY_CLASS_FLOOR = Object.freeze({
    application_fee: 'operating_income',
    laundry: 'operating_income'
});

/** Descriptive grouping of categories for reporting; never affects classification. */
export const CATEGORY_GROUPS = Object.freeze({
    rent: 'Rent & fees',
    late_fee: 'Rent & fees',
    pet_fee: 'Rent & fees',
    application_fee: 'Rent & fees',
    reimbursement: 'Reimbursements',
    screening: 'Professional',
    security_deposit: 'Deposits',
    pet_deposit: 'Deposits',
    insurance: 'Property expenses',
    property_tax: 'Property expenses',
    mortgage_interest: 'Property expenses',
    hoa_fee: 'Property expenses',
    management_fee: 'Property expenses',
    advertising: 'Property expenses',
    maintenance: 'Repairs',
    capital_improvement: 'Repairs',
    cleaning_fee: 'Repairs',
    utility: 'Utilities',
    laundry: 'Other income',
    legal_fees: 'Professional',
    other: 'Other'
});

/**
 * The accounts-receivable delta for one entry, in cents. A charge increases what a tenant owes; a payment
 * or deposit application decreases it; a refund moves the balance up toward zero from a credit.
 *
 * @param {import('./types.js').LedgerEntry} entry
 * @returns {number} The signed AR delta in cents; 0 when the class does not touch AR.
 */
export function arDelta(entry) {
    const s = CLASS_SEMANTICS[entry.entryClass];
    if (!s || s.ar === 'none') return 0;
    return s.ar === 'increase' ? entry.amountCents : -entry.amountCents;
}

/**
 * The deposit-liability delta for one entry, in cents. Collecting raises the liability; returning,
 * forfeiting, or applying lowers it.
 *
 * @param {import('./types.js').LedgerEntry} entry
 * @returns {number} The signed deposit delta in cents; 0 when the class does not touch the deposit.
 */
export function depositDelta(entry) {
    if (entry.entryClass === 'deposit_application') return -entry.amountCents;
    if (entry.entryClass !== 'deposit_movement') return 0;
    const eff = DEPOSIT_EFFECT[entry.depositEffect];
    if (!eff || eff.deposit === 'none') return 0;
    return eff.deposit === 'increase' ? entry.amountCents : -entry.amountCents;
}

/**
 * The cash delta for one entry, in cents — money in is positive, money out is negative.
 *
 * @param {import('./types.js').LedgerEntry} entry
 * @returns {number} The signed cash delta in cents; 0 when no cash moves.
 */
export function cashDelta(entry) {
    const s = CLASS_SEMANTICS[entry.entryClass];
    if (!s) return 0;
    if (entry.entryClass === 'deposit_movement') {
        const eff = DEPOSIT_EFFECT[entry.depositEffect];
        if (!eff || eff.cash === 'none') return 0;
        return eff.cash === 'in' ? entry.amountCents : -entry.amountCents;
    }
    if (s.cash === 'in') return entry.amountCents;
    if (s.cash === 'out') return -entry.amountCents;
    return 0;
}

/**
 * The profit-and-loss delta for one entry, in cents, on a cash basis. Accounts receivable is never summed
 * into P&L. Income is positive, expense is negative.
 *
 * @param {import('./types.js').LedgerEntry} entry
 * @returns {number} The signed P&L delta in cents; 0 when the class does not touch P&L.
 */
export function pnlDelta(entry) {
    const s = CLASS_SEMANTICS[entry.entryClass];
    if (!s) return 0;
    if (entry.entryClass === 'deposit_movement') {
        const eff = DEPOSIT_EFFECT[entry.depositEffect];
        if (!eff || eff.pnl === 'none') return 0;
        return eff.pnl === 'income' ? entry.amountCents : -entry.amountCents;
    }
    if (s.pnl === 'none') return 0;
    return s.pnl === 'income' ? entry.amountCents : -entry.amountCents;
}
