/**
 * The framework-agnostic ledger engine — every primitive, the taxonomy, and the fold.
 * Import from here for the full engine, or from a specific module for one concern.
 *
 * @module core
 */

// Money primitives.
export {
    MAX_AMOUNT_CENTS,
    cents,
    fmt,
    fmtSigned,
    allocate,
    prorateRent
} from './money.js';

// Accounting periods.
export {
    periodKey,
    periodFromDate,
    periodCmp,
    periodLabel,
    periodRange
} from './period.js';

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
} from './taxonomy.js';

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
} from './fold.js';

// The minimal-entry classifier.
export { deriveClassification } from './classify.js';

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
} from './validate.js';

// Re-bill.
export {
    REBILL_CATEGORY,
    reBillCharges,
    reBillSummary,
    reBillEligible,
    planReBill
} from './rebill.js';
