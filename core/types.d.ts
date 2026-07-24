/**
 * Domain shapes — TypeScript Declarations.
 *
 * @module core/types
 * @version 1.0.1
 */

export interface Period {
    month: number;
    year: number;
}

export interface Party {
    contact: string;
    role: string;
    nameSnapshot: string;
    viaLease: boolean;
}

export interface Allocation {
    charge: string;
    amountCents: number;
}

export interface LedgerEntry {
    id: string;
    entryClass: string;
    category: string;
    amountCents: number;
    date: string;
    period: Period;
    property?: string | null;
    lease?: string | null;
    vendor?: string | null;
    scopeLevel?: string;
    depositEffect?: string | null;
    party?: Party[];
    allocations?: Allocation[] | null;
    reBilledFrom?: string | null;
    deletedAt?: string | null;
    source?: string;
    prorationBasis?: { activeDays: number; daysInMonth: number } | null;
}

export interface Lease {
    id: string;
    property: string;
    label?: string;
    rentCents: number;
    contacts: string[];
    primaryContact?: string;
    requiredSecurityDepositCents?: number;
    requiredPetDepositCents?: number;
    status?: string;
}

export interface LedgerStore {
    entries: LedgerEntry[];
    leases: Lease[];
    properties?: { id: string }[];
    contacts?: { id: string }[];
    vendors?: { id: string }[];
}

export interface LeaseProjection {
    lease: string;
    property: string | null;
    period: Period;
    chargesCents: number;
    paymentsCents: number;
    openingCents: number;
    totalOwedCents: number;
    closingCents: number;
    balanceCents: number;
    creditCents: number;
    status: string | null;
    entryIds: string[];
}

export interface LeaseBalance {
    closingCents: number;
    creditCents: number;
    latestPeriod: Period | null;
    status: string | null;
}

export interface SettlementApplication {
    payment: string;
    amountCents: number;
    targeted: boolean;
}

export interface SettlementItem {
    id: string;
    entryClass: string;
    category: string;
    date: string;
    period: Period;
    chargedCents: number;
    paidCents: number;
    openCents: number;
    settled: boolean;
    applications: SettlementApplication[];
}

export interface ChargeSettlement {
    items: SettlementItem[];
    creditCents: number;
    netCents: number;
    openCents: number;
    warnings: { payment: string; charge: string; issue: string }[];
}
