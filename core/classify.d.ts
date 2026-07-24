/**
 * The minimal-entry classifier — TypeScript Declarations.
 *
 * @module core/classify
 * @version 1.0.1
 */
import type { LedgerStore } from './types.js';

export interface ClassifyInput {
    anchor: { type: string; id?: string };
    direction?: string;
    mode?: string | null;
    category?: string;
    propertyId?: string | null;
}

export interface Classification {
    entryClass: string;
    scopeLevel: string;
    property?: string | null;
    lease?: string | null;
    vendor?: string | null;
    depositEffect?: string;
    note?: string;
    inferredFields: string[];
}

export declare function deriveClassification(
    store: LedgerStore,
    input: ClassifyInput
): Classification;
