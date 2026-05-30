/**
 * @joelouf/ledger-system
 *
 * A zero-dependency, append-only ledger engine. Record one immutable transaction log, then read every
 * balance, status, P&L line, and deposit liability as a deterministic fold over it. There are no parallel
 * sources of truth: the dashboard total always reconciles to the sum of the tenant ledgers because both
 * are the same fold, recomputed from the same entries.
 *
 * @module @joelouf/ledger-system
 */

// Money primitives.
export {
    MAX_AMOUNT_CENTS,
    cents,
    fmt,
    fmtSigned,
    allocate,
    prorateRent
} from './core/money.js';

// Accounting periods.
export {
    periodKey,
    periodFromDate,
    periodCmp,
    periodLabel,
    periodRange
} from './core/period.js';

// Financial-class taxonomy and deltas.
export {
    CLASS_SEMANTICS,
    DEPOSIT_EFFECT,
    CATEGORY_CLASS_FLOOR,
    CATEGORY_GROUPS,
    arDelta,
    depositDelta,
    cashDelta,
    pnlDelta
} from './core/taxonomy.js';

// The fold.
export {
    liveEntries,
    replayLeaseLedger,
    leaseBalance,
    dashboardOutstanding,
    propertyOutstanding,
    propertyPnL,
    portfolioPnL,
    depositLiability,
    depositStatus,
    depositRegister,
    totalDepositLiability,
    contactFeed,
    portfolio,
    chargeSettlement
} from './core/fold.js';

// The minimal-entry classifier.
export { deriveClassification } from './core/classify.js';

// The boundary guards.
export {
    ROSTER_ROLES,
    PRELEASE_ROLES,
    PARTY_ROLES,
    validateAmount,
    validateScopeLegality,
    validateParty,
    validateAllocations,
    validateEntry
} from './core/validate.js';

// Re-bill.
export {
    REBILL_CATEGORY,
    reBillCharges,
    reBillSummary,
    reBillEligible,
    planReBill
} from './core/rebill.js';
