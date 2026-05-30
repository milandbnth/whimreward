/**
 * Re-bill — TypeScript Declarations.
 *
 * @module core/rebill
 * @version 1.0.0
 */
import type { LedgerEntry, LedgerStore } from './types.js';

export declare const REBILL_CATEGORY: string;

export declare function reBillCharges(
    store: LedgerStore,
    expenseId: string
): LedgerEntry[];

export interface ReBillSummary {
    expenseId: string;
    expenseCents: number;
    recoveredCents: number;
    absorbedCents: number;
    overRecoveredCents: number;
    chargeIds: string[];
    count: number;
}

export declare function reBillSummary(
    store: LedgerStore,
    expenseId: string
): ReBillSummary;
export declare function reBillEligible(
    store: LedgerStore,
    entry: LedgerEntry
): boolean;
export declare function planReBill(
    store: LedgerStore,
    expenseId: string,
    opts?: { leaseIds?: string[]; weights?: number[]; totalCents?: number }
): Array<{ lease: string; amountCents: number }>;
