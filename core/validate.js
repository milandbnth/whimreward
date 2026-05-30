/**
 * The boundary guards — the single gate every writer must pass before an entry reaches the fold.
 * Amounts are positive integer cents (magnitude only; sign derives from the class), scope is legal for the
 * class, party roles agree with the lease relationship, and any allocation hint fits within the payment.
 * Keeping NaN, negative, fractional, oversized, and structurally illegal entries out is what lets the fold
 * stay a simple, total function over clean data.
 *
 * @module core/validate
 */

import { fmt, MAX_AMOUNT_CENTS } from './money.js';
import { CLASS_SEMANTICS, DEPOSIT_EFFECT } from './taxonomy.js';

/** Party roles that imply a lease (a roster membership). */
export const ROSTER_ROLES = ['tenant', 'co_tenant'];

/** Party roles that imply no lease yet (a pre-tenancy relationship). */
export const PRELEASE_ROLES = ['applicant', 'prospect', 'guarantor'];

/** Every allowed party role. */
export const PARTY_ROLES = [...ROSTER_ROLES, ...PRELEASE_ROLES];

/**
 * Validate an entry's amount. Amounts are positive whole cents — magnitude only; the sign always derives
 * from the class, never the amount. This is the boundary that keeps NaN, negative, fractional, and
 * oversized values out of the fold.
 *
 * @param {import('./types.js').LedgerEntry} entry
 * @returns {string[]} An array of error messages; empty when the amount is valid.
 */
export function validateAmount(entry) {
    const a = entry.amountCents;
    if (typeof a !== 'number' || !Number.isFinite(a))
        return ['amount must be a finite number of cents'];
    if (!Number.isInteger(a))
        return ['amount must be whole cents (no fractional cents)'];
    if (a <= 0)
        return [
            'amount must be positive — sign derives from the entry class, not the amount'
        ];
    if (a > MAX_AMOUNT_CENTS)
        return [
            'amount exceeds the maximum allowed (' + fmt(MAX_AMOUNT_CENTS) + ')'
        ];
    return [];
}

/**
 * Validate that an entry's scope (general / property / lease) is legal for its class.
 *
 * @param {import('./types.js').LedgerEntry} entry
 * @param {import('./types.js').LedgerStore} store
 * @returns {string[]} An array of error messages; empty when the scope is legal.
 */
export function validateScopeLegality(entry, store) {
    const s = CLASS_SEMANTICS[entry.entryClass];
    const errs = [];
    if (entry.scopeLevel === 'general' && (entry.property || entry.lease))
        errs.push('general scope must have no property/lease');
    if (entry.scopeLevel === 'property' && (!entry.property || entry.lease))
        errs.push('property scope needs property, no lease');
    if (entry.scopeLevel === 'lease' && (!entry.property || !entry.lease))
        errs.push('lease scope needs both property and lease');
    if (s && s.leaseRequired && entry.scopeLevel !== 'lease')
        errs.push(`${entry.entryClass} requires lease scope`);
    if (entry.scopeLevel === 'lease' && entry.lease) {
        const lease = store.leases.find((l) => l.id === entry.lease);
        if (lease && entry.property && lease.property !== entry.property)
            errs.push('lease.property must equal the entry property');
    }
    return errs;
}

/**
 * Validate the party roster on an entry. A roster role implies a lease and `viaLease:true`; a pre-tenancy
 * role implies no lease and `viaLease:false`. The name is required because it is frozen at write time.
 *
 * @param {import('./types.js').LedgerEntry} entry
 * @param {import('./types.js').LedgerStore} store
 * @returns {string[]} An array of error messages; empty when the party is valid.
 */
export function validateParty(entry, store) {
    if (entry.party == null) return [];
    if (!Array.isArray(entry.party)) return ['party must be an array'];
    const errs = [];
    for (const p of entry.party) {
        if (!p || typeof p.contact !== 'string' || !p.contact) {
            errs.push('each party needs a contact id');
            continue;
        }
        if (
            store &&
            store.contacts &&
            !store.contacts.some((c) => c.id === p.contact)
        )
            errs.push(`party.contact "${p.contact}" is not a known contact`);
        if (!p.nameSnapshot)
            errs.push('party needs a nameSnapshot (frozen at write)');
        if (PARTY_ROLES.indexOf(p.role) === -1)
            errs.push(`party.role "${p.role}" is not an allowed role`);
        if (entry.lease) {
            if (p.viaLease !== true)
                errs.push(
                    'a party on a lease-scoped entry must be viaLease:true (roster-derived)'
                );
            else if (ROSTER_ROLES.indexOf(p.role) === -1)
                errs.push(
                    `lease-scoped party.role must be one of ${ROSTER_ROLES.join('/')}`
                );
        } else {
            if (p.viaLease !== false)
                errs.push(
                    'a party on a non-lease entry must be viaLease:false'
                );
            else if (PRELEASE_ROLES.indexOf(p.role) === -1)
                errs.push(
                    `non-lease party.role must be one of ${PRELEASE_ROLES.join('/')}`
                );
        }
    }
    return errs;
}

/**
 * Validate a payment's allocation hints. Each is a positive whole-cent amount that does not exceed the
 * payment. Targets are advisory — a missing or closed charge falls back to FIFO at settlement time — so a
 * bad target is a settlement warning, never a write-time rejection.
 *
 * @param {import('./types.js').LedgerEntry} entry
 * @returns {string[]} An array of error messages; empty when the allocations are valid.
 */
export function validateAllocations(entry) {
    if (entry.allocations == null) return [];
    if (!Array.isArray(entry.allocations))
        return ['allocations must be an array'];
    const errs = [];
    let sum = 0;
    for (const a of entry.allocations) {
        if (
            !a ||
            typeof a.amountCents !== 'number' ||
            !Number.isInteger(a.amountCents) ||
            a.amountCents <= 0
        ) {
            errs.push(
                'each allocation needs a positive whole-cent amountCents'
            );
            continue;
        }
        if (!a.charge) errs.push('each allocation needs a target charge id');
        sum += a.amountCents;
    }
    if (sum > entry.amountCents)
        errs.push(
            'allocations (' +
                fmt(sum) +
                ') exceed the payment amount (' +
                fmt(entry.amountCents) +
                ')'
        );
    return errs;
}

/**
 * The single boundary guard every writer must pass. Composes class validity, amount, deposit effect,
 * allocation, party, and scope legality. Returns an empty array when the entry is clean.
 *
 * @param {import('./types.js').LedgerEntry} entry
 * @param {import('./types.js').LedgerStore} store
 * @returns {string[]} An array of error messages; empty when the entry is valid.
 */
export function validateEntry(entry, store) {
    const errs = [];
    if (!CLASS_SEMANTICS[entry.entryClass])
        errs.push('unknown entryClass: ' + entry.entryClass);
    errs.push(...validateAmount(entry));
    if (
        entry.entryClass === 'deposit_movement' &&
        !DEPOSIT_EFFECT[entry.depositEffect]
    ) {
        errs.push(
            'deposit_movement requires depositEffect in {collect, return, forfeit}'
        );
    }
    errs.push(...validateAllocations(entry));
    errs.push(...validateParty(entry, store));
    errs.push(...validateScopeLegality(entry, store));
    return errs;
}
