/**
 * Accounting periods — TypeScript Declarations.
 *
 * @module core/period
 * @version 1.0.1
 */
import type { Period } from './types.js';

export declare function periodKey(period: Period): string;
export declare function periodFromDate(iso: string): Period;
export declare function periodCmp(a: Period, b: Period): number;
export declare function periodLabel(period: Period): string;
export declare function periodRange(from: Period, to: Period): Period[];
