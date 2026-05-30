/**
 * @joelouf/ledger-system - TypeScript Declarations.
 *
 * @version 1.0.0
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

// Re-export all types.
export type {
    Period,
    Party,
    Allocation,
    LedgerEntry,
    Lease,
    LedgerStore,
    LeaseProjection,
    LeaseBalance,
    SettlementApplication,
    SettlementItem,
    ChargeSettlement
} from './core/types.js';
export type { EntryClass, ClassSemantics } from './core/taxonomy.js';
export type { DashboardLine, PropertyPnL } from './core/fold.js';
export type { ClassifyInput, Classification } from './core/classify.js';
export type { ReBillSummary } from './core/rebill.js';
