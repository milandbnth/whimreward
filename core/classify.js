/**
 * The minimal-entry classifier — the sole producer of an entry's class and scope.
 * Given a who-and-what anchor, it infers the financial class, scope level, and the fields that follow,
 * so a caller supplies the minimum and the engine derives the rest. A category with an intrinsic class
 * (the category floor) overrides the anchor default — a kept application fee is income under any anchor.
 *
 * @module core/classify
 */

import { CATEGORY_CLASS_FLOOR } from './taxonomy.js';

/**
 * @typedef {object} ClassifyInput
 * @property {{ type: string, id?: string }} anchor - Who the money is to or from.
 * @property {string} [direction] - 'in' | 'out', for property/general/vendor anchors.
 * @property {string | null} [mode] - For a lease anchor: 'bill', 'deposit_collect', etc.
 * @property {string} [category] - The descriptive category; may carry an intrinsic class floor.
 * @property {string | null} [propertyId] - The property to attribute a vendor expense to.
 */

/**
 * @typedef {object} Classification
 * @property {string} entryClass - The derived financial class.
 * @property {string} scopeLevel - 'general' | 'property' | 'lease'.
 * @property {string | null} [property]
 * @property {string | null} [lease]
 * @property {string | null} [vendor]
 * @property {string} [depositEffect]
 * @property {string} [note]
 * @property {string[]} inferredFields - A human-readable trace of what was inferred.
 */

/**
 * Derive the financial class and scope for a new entry from its anchor. The UI never sets these; this is
 * the single classifier, so the same input always yields the same class.
 *
 * @param {import('./types.js').LedgerStore} store
 * @param {ClassifyInput} input
 * @returns {Classification}
 */
export function deriveClassification(store, input) {
    const { anchor, direction, mode, category } = input;
    const floor = category && CATEGORY_CLASS_FLOOR[category];
    /** @type {any} */
    const inferred = { inferredFields: [] };

    if (anchor.type === 'lease') {
        const lease = store.leases.find((l) => l.id === anchor.id);
        if (!lease)
            throw new Error(
                `deriveClassification: no lease found for anchor id "${anchor.id}"`
            );
        inferred.lease = lease.id;
        inferred.property = lease.property;
        inferred.scopeLevel = 'lease';
        inferred.inferredFields.push(
            'scopeLevel=lease',
            'property (from lease)',
            'party (from lease roster)'
        );
        const depositCat =
            category === 'security_deposit' || category === 'pet_deposit';
        if (floor) {
            inferred.entryClass = floor;
            inferred.note = `category "${category}" is intrinsically ${floor} — overrides anchor default`;
        } else if (mode === 'bill') {
            inferred.entryClass = 'tenant_charge';
        } else if (mode === 'deposit_collect') {
            inferred.entryClass = 'deposit_movement';
            inferred.depositEffect = 'collect';
        } else if (mode === 'deposit_return') {
            inferred.entryClass = 'deposit_movement';
            inferred.depositEffect = 'return';
        } else if (mode === 'deposit_forfeit') {
            inferred.entryClass = 'deposit_movement';
            inferred.depositEffect = 'forfeit';
        } else if (mode === 'deposit_apply') {
            inferred.entryClass = 'deposit_application';
        } else if (direction === 'out') {
            inferred.entryClass = 'tenant_refund';
        } else {
            inferred.entryClass = depositCat
                ? 'deposit_movement'
                : 'tenant_payment';
            if (depositCat) inferred.depositEffect = 'collect';
        }
        inferred.inferredFields.push('entryClass=' + inferred.entryClass);
    } else if (anchor.type === 'vendor') {
        inferred.vendor = anchor.id;
        inferred.lease = null;
        inferred.property = input.propertyId || null;
        inferred.scopeLevel = input.propertyId ? 'property' : 'general';
        inferred.entryClass = floor || 'operating_expense';
        inferred.inferredFields.push(
            'entryClass=' + inferred.entryClass,
            'scopeLevel=' + inferred.scopeLevel,
            'lease=null'
        );
    } else if (anchor.type === 'property') {
        inferred.property = anchor.id;
        inferred.lease = null;
        inferred.scopeLevel = 'property';
        inferred.entryClass =
            floor ||
            (direction === 'in' ? 'operating_income' : 'operating_expense');
        inferred.inferredFields.push(
            'entryClass=' + inferred.entryClass,
            'scopeLevel=property',
            'lease=null'
        );
    } else {
        inferred.property = null;
        inferred.lease = null;
        inferred.scopeLevel = 'general';
        inferred.entryClass =
            floor ||
            (direction === 'in' ? 'operating_income' : 'operating_expense');
        inferred.inferredFields.push(
            'entryClass=' + inferred.entryClass,
            'scopeLevel=general'
        );
    }
    return inferred;
}
