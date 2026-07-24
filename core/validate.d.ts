/**
 * The boundary guards — TypeScript Declarations.
 *
 * @module core/validate
 * @version 1.0.1
 */
import type { LedgerEntry, LedgerStore } from './types.js';

export declare const ROSTER_ROLES: string[];
export declare const PRELEASE_ROLES: string[];
export declare const PARTY_ROLES: string[];

export declare function validateAmount(entry: LedgerEntry): string[];
export declare function validateScopeLegality(
    entry: LedgerEntry,
    store: LedgerStore
): string[];
export declare function validateParty(
    entry: LedgerEntry,
    store: LedgerStore
): string[];
export declare function validateAllocations(entry: LedgerEntry): string[];
export declare function validateEntry(
    entry: LedgerEntry,
    store: LedgerStore
): string[];
