/**
 * Money primitives for the ledger.
 * Every amount is an integer number of cents — there is no floating-point money anywhere in the engine.
 * Sums over a realistic portfolio stay well under Number.MAX_SAFE_INTEGER, so totals are always exact.
 *
 * @module core/money
 */

/**
 * Sanity bound for a single amount, in cents. Catches typos and overflow long before any sum can lose
 * precision. Adjust only if a use case legitimately needs more than one billion dollars in one entry.
 */
export const MAX_AMOUNT_CENTS = 1e11;

/**
 * Convert a dollar amount to integer cents, rounding to the nearest cent.
 *
 * @param {number} dollars - The amount in dollars.
 * @returns {number} The amount in whole cents.
 */
export function cents(dollars) {
    return Math.round(dollars * 100);
}

/**
 * Format an integer-cent amount as a localized USD string (e.g. -12345 becomes '-$123.45').
 *
 * @param {number} amountCents - The amount in cents.
 * @returns {string}
 */
export function fmt(amountCents) {
    return (
        (amountCents < 0 ? '-' : '') +
        '$' +
        (Math.abs(amountCents) / 100).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })
    );
}

/**
 * Format an integer-cent amount with an explicit sign, so a positive value reads '+$123.45'.
 *
 * @param {number} amountCents - The amount in cents.
 * @returns {string}
 */
export function fmtSigned(amountCents) {
    const sign = amountCents > 0 ? '+' : amountCents < 0 ? '-' : '';
    return (
        sign +
        '$' +
        (Math.abs(amountCents) / 100).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })
    );
}

/**
 * Split a non-negative integer-cent total into weighted parts that ALWAYS sum back to exactly the total.
 * Uses the largest-remainder method, so no cent is ever created or lost. This is the reusable primitive
 * behind every multi-way split — proration, roommate shares, owner distributions, applying one payment
 * across several charges.
 *
 * @param {number} totalCents - The non-negative total to divide, in cents.
 * @param {number[]} weights - One weight per output part; equal weights split evenly.
 * @returns {number[]} The parts, in cents, summing to exactly totalCents.
 */
export function allocate(totalCents, weights) {
    const n = weights.length;
    if (!n) return [];
    const sum = weights.reduce((s, w) => s + w, 0);
    const exact =
        sum > 0
            ? weights.map((w) => (totalCents * w) / sum)
            : weights.map(() => totalCents / n);
    const floored = exact.map((x) => Math.floor(x));
    const remainder = totalCents - floored.reduce((s, x) => s + x, 0);
    const order = exact
        .map((x, i) => ({ i, frac: x - Math.floor(x) }))
        .sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < remainder; k++) floored[order[k % n].i] += 1;
    return floored;
}

/**
 * Prorate a monthly rent for a partial month, rounded to the nearest cent. A full (or over-full) month
 * returns the rent unchanged; a zero-length month is guarded and also returns the rent unchanged.
 *
 * @param {number} rentCents - The full monthly rent, in cents.
 * @param {number} activeDays - The number of days the lease is active in the month.
 * @param {number} daysInMonth - The number of days in the month.
 * @returns {number} The prorated rent, in cents.
 */
export function prorateRent(rentCents, activeDays, daysInMonth) {
    if (!(daysInMonth > 0) || activeDays >= daysInMonth) return rentCents;
    return Math.round((rentCents * activeDays) / daysInMonth);
}
