/**
 * Accounting periods — a month/year bucket that an entry folds into.
 * Period derivation is timezone-safe: a date-only string is parsed from its own characters, so a value
 * like '2026-05-01' can never drift to the prior day under a negative-UTC offset.
 *
 * @module core/period
 */

const MONTHS = [
    '',
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
];

/**
 * Build the canonical string key for a period, e.g. { month: 5, year: 2026 } becomes '2026-05'.
 *
 * @param {import('./types.js').Period} period - The period to key.
 * @returns {string}
 */
export function periodKey(period) {
    return `${period.year}-${String(period.month).padStart(2, '0')}`;
}

/**
 * Derive a period from an ISO date. Date-only strings are read character-by-character to avoid the classic
 * `new Date('2026-05-01')` timezone drift; other inputs fall back to Date parsing.
 *
 * @param {string} iso - An ISO date or date-time string.
 * @returns {import('./types.js').Period}
 */
export function periodFromDate(iso) {
    if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso)) {
        const [y, m] = iso.slice(0, 10).split('-').map(Number);
        return { month: m, year: y };
    }
    const d = new Date(iso);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
}

/**
 * Compare two periods chronologically. Returns a negative number if `a` is earlier, positive if later,
 * zero if equal — suitable as an Array.sort comparator.
 *
 * @param {import('./types.js').Period} a
 * @param {import('./types.js').Period} b
 * @returns {number}
 */
export function periodCmp(a, b) {
    return a.year !== b.year ? a.year - b.year : a.month - b.month;
}

/**
 * Format a period for display, e.g. 'May 2026'.
 *
 * @param {import('./types.js').Period} period
 * @returns {string}
 */
export function periodLabel(period) {
    return MONTHS[period.month] + ' ' + period.year;
}

/**
 * Enumerate every period from `from` through `to`, inclusive, in chronological order.
 *
 * @param {import('./types.js').Period} from - The first period.
 * @param {import('./types.js').Period} to - The last period.
 * @returns {import('./types.js').Period[]}
 */
export function periodRange(from, to) {
    const out = [];
    let y = from.year;
    let m = from.month;
    while (y < to.year || (y === to.year && m <= to.month)) {
        out.push({ month: m, year: y });
        m++;
        if (m > 12) {
            m = 1;
            y++;
        }
    }
    return out;
}
