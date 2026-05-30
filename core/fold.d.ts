/**
 * The fold — TypeScript Declarations.
 *
 * @module core/fold
 * @version 1.0.0
 */
import type {
    ChargeSettlement,
    Lease,
    LeaseBalance,
    LeaseProjection,
    LedgerEntry,
    LedgerStore,
    Period
} from './types.js';

export declare function liveEntries(store: LedgerStore): LedgerEntry[];
export declare function replayLeaseLedger(
    store: LedgerStore,
    leaseId: string
): LeaseProjection[];
export declare function leaseBalance(
    store: LedgerStore,
    leaseId: string
): LeaseBalance;

export interface DashboardLine {
    lease: Lease;
    owedCents: number;
    creditCents: number;
    latestPeriod: Period | null;
}
export declare function dashboardOutstanding(store: LedgerStore): {
    totalCents: number;
    perLease: DashboardLine[];
};
export declare function propertyOutstanding(
    store: LedgerStore,
    propertyId: string
): number;

export interface PropertyPnL {
    income: Record<string, number>;
    expense: Record<string, number>;
    incomeTotalCents: number;
    expenseTotalCents: number;
    netCents: number;
}
export declare function propertyPnL(
    store: LedgerStore,
    propertyId: string,
    year: number
): PropertyPnL;
export declare function portfolioPnL(
    store: LedgerStore,
    year?: number
): { incomeCents: number; expenseCents: number; netCents: number };

export declare function depositLiability(
    store: LedgerStore,
    leaseId: string
): number;
export declare function depositStatus(
    store: LedgerStore,
    lease: Lease
): 'held' | 'partially_returned' | 'returned' | 'forfeit' | 'none';
export declare function depositRegister(
    store: LedgerStore
): { lease: Lease; requiredCents: number; heldCents: number; status: string }[];
export declare function totalDepositLiability(store: LedgerStore): number;

export declare function contactFeed(
    store: LedgerStore,
    contactId: string
): LedgerEntry[];
export declare function portfolio(
    store: LedgerStore,
    filters?: {
        entryClass?: string;
        propertyId?: string;
        scopeLevel?: string;
        year?: number;
    }
): LedgerEntry[];
export declare function chargeSettlement(
    store: LedgerStore,
    leaseId: string
): ChargeSettlement;
