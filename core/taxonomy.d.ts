/**
 * Financial-class taxonomy and deltas — TypeScript Declarations.
 *
 * @module core/taxonomy
 * @version 1.0.0
 */
import type { LedgerEntry } from './types.js';

export type EntryClass =
    | 'operating_income'
    | 'operating_expense'
    | 'tenant_charge'
    | 'tenant_payment'
    | 'tenant_refund'
    | 'deposit_movement'
    | 'deposit_application';

export interface ClassSemantics {
    label: string;
    cash: 'in' | 'out' | 'none' | 'flex';
    pnl: 'income' | 'expense' | 'none';
    ar: 'increase' | 'decrease' | 'none';
    deposit: 'increase' | 'decrease' | 'none' | 'flex';
    leaseRequired: boolean;
    color: string;
}

export declare const CLASS_SEMANTICS: Readonly<
    Record<EntryClass, ClassSemantics>
>;
export declare const DEPOSIT_EFFECT: Readonly<
    Record<
        'collect' | 'return' | 'forfeit',
        {
            cash: 'in' | 'out' | 'none';
            deposit: 'increase' | 'decrease';
            pnl: 'income' | 'none';
        }
    >
>;
export declare const CATEGORY_CLASS_FLOOR: Readonly<Record<string, EntryClass>>;
export declare const CATEGORY_GROUPS: Readonly<Record<string, string>>;

export declare function arDelta(entry: LedgerEntry): number;
export declare function depositDelta(entry: LedgerEntry): number;
export declare function cashDelta(entry: LedgerEntry): number;
export declare function pnlDelta(entry: LedgerEntry): number;
