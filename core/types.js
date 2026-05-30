/**
 * Domain shapes for the ledger — JSDoc type definitions only, no runtime code.
 * Every record is a plain, fully serializable object; the engine never mutates one in place.
 * A ledger entry is append-only: once written, it is corrected or voided, never edited.
 *
 * @module core/types
 */

/**
 * @typedef {object} Period
 * @property {number} month - The accounting month, 1-12.
 * @property {number} year - The accounting year.
 */

/**
 * @typedef {object} Party
 * @property {string} contact - The contact id this party refers to.
 * @property {string} role - The party role (e.g. 'tenant', 'co_tenant', 'applicant').
 * @property {string} nameSnapshot - The party name, frozen at write time.
 * @property {boolean} viaLease - Whether this party was derived from a lease roster.
 */

/**
 * @typedef {object} Allocation
 * @property {string} charge - The id of the charge this payment targets.
 * @property {number} amountCents - The targeted amount, in cents.
 */

/**
 * @typedef {object} LedgerEntry
 * @property {string} id
 * @property {string} entryClass - One of the seven financial classes (see core/taxonomy).
 * @property {string} category - A descriptive category; never the classifier.
 * @property {number} amountCents - A positive magnitude in cents; sign derives from the class.
 * @property {string} date - The ISO date the event occurred.
 * @property {Period} period - The accounting period the entry folds into.
 * @property {string | null} [property] - The property scope, if any.
 * @property {string | null} [lease] - The lease scope, if any.
 * @property {string | null} [vendor] - The vendor counterparty, if any.
 * @property {string} [scopeLevel] - 'general' | 'property' | 'lease'.
 * @property {string | null} [depositEffect] - For deposit_movement: 'collect' | 'return' | 'forfeit'.
 * @property {Party[]} [party] - The people this entry is attributed to.
 * @property {Allocation[] | null} [allocations] - Optional payment-to-charge targeting hints.
 * @property {string | null} [reBilledFrom] - For a passthrough charge, the source expense id.
 * @property {string | null} [deletedAt] - When set, the entry is excluded from every fold.
 * @property {string} [source]
 * @property {Object<string, unknown>} [prorationBasis]
 */

/**
 * @typedef {object} Lease
 * @property {string} id
 * @property {string} property - The property this lease belongs to.
 * @property {string} [label]
 * @property {number} rentCents
 * @property {string[]} contacts - The roster of contact ids.
 * @property {string} [primaryContact]
 * @property {number} [requiredSecurityDepositCents]
 * @property {number} [requiredPetDepositCents]
 * @property {string} [status] - 'active' | 'terminated' | etc.
 */

/**
 * @typedef {object} LedgerStore
 * @property {LedgerEntry[]} entries
 * @property {Lease[]} leases
 * @property {Array<{ id: string }>} [properties]
 * @property {Array<{ id: string }>} [contacts]
 * @property {Array<{ id: string }>} [vendors]
 */

/**
 * @typedef {object} LeaseProjection
 * @property {string} lease
 * @property {string | null} property
 * @property {Period} period
 * @property {number} chargesCents
 * @property {number} paymentsCents
 * @property {number} openingCents
 * @property {number} totalOwedCents
 * @property {number} closingCents
 * @property {number} balanceCents
 * @property {number} creditCents
 * @property {string | null} status
 * @property {string[]} entryIds
 */

/**
 * @typedef {object} LeaseBalance
 * @property {number} closingCents
 * @property {number} creditCents
 * @property {Period | null} latestPeriod
 * @property {string | null} status
 */

export {};
