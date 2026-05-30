/**
 * Money primitives — TypeScript Declarations.
 *
 * @module core/money
 * @version 1.0.0
 */
export declare const MAX_AMOUNT_CENTS: number;
export declare function cents(dollars: number): number;
export declare function fmt(amountCents: number): string;
export declare function fmtSigned(amountCents: number): string;
export declare function allocate(
    totalCents: number,
    weights: number[]
): number[];
export declare function prorateRent(
    rentCents: number,
    activeDays: number,
    daysInMonth: number
): number;
