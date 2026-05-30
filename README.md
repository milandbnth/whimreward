# @joelouf/ledger-system

A zero-dependency, append-only ledger engine that derives every figure as a deterministic fold over one immutable transaction log.

Record money once as immutable entries, then read every balance, status, P&L line, and deposit liability as a pure recomputation over those entries. There are no parallel sources of truth: the dashboard total always reconciles to the sum of the tenant ledgers because both are the same fold, computed from the same data.

## Features

- **Zero runtime dependencies** - pure JavaScript, no transitive packages, nothing to audit but the source
- **Integer cents everywhere** - no floating-point money; every amount is a whole number of cents, so sums are always exact
- **Append-only by construction** - entries are corrected or voided, never edited; deletion is read in exactly one place, so a voided line leaves every derived figure at once
- **One fold, no parallel truth** - balance, status, P&L, deposit liability, and dashboard total all derive from the same entries, so they cannot disagree
- **Seven-class taxonomy** - `entryClass` is the sole classifier; cash, P&L, AR, and deposit effects derive from it at fold time and are never stored
- **Cash-basis P&L** - income at collection, expenses at payment; accounts receivable is never summed into P&L
- **Exact-sum money division** - `allocate` splits any total into weighted parts that always sum back to the exact total, so no cent is ever created or lost
- **Timezone-safe periods** - date-only values never drift to the prior day under a negative-UTC offset
- **Per-charge settlement** - FIFO with optional targeting, where the allocation is a stored hint that can never move the lease balance

## Architecture

```
core/
  types.js              # Domain shapes (LedgerEntry, Lease, LedgerStore, projections)
  money.js              # Integer-cent math: cents, formatting, exact-sum allocate, proration
  period.js             # Timezone-safe accounting periods
  taxonomy.js           # The seven financial classes and the per-entry cash/P&L/AR/deposit deltas
  fold.js               # The fold: balances, status, P&L, deposits, contact feed, settlement
```

The engine is pure and stateless. It reads a store of entries and produces derived figures; it performs no I/O, holds no ambient state, and never mutates an input. Persistence, lifecycle, and presentation belong to the consumer.

## Install

```bash
npm install @joelouf/ledger-system
```

## Quick Start

### Build a Store

```js
const store = {
    leases: [
        { id: 'L1', property: 'p1', rentCents: 180000, contacts: ['c1'], primaryContact: 'c1', requiredSecurityDepositCents: 180000, status: 'active' }
    ],
    entries: [
        { id: 'e1', entryClass: 'tenant_charge', category: 'rent', amountCents: 180000, date: '2026-05-01', period: { month: 5, year: 2026 }, lease: 'L1', property: 'p1', scopeLevel: 'lease' },
        { id: 'e2', entryClass: 'tenant_payment', category: 'rent', amountCents: 100000, date: '2026-05-03', period: { month: 5, year: 2026 }, lease: 'L1', property: 'p1', scopeLevel: 'lease' }
    ]
};
```

### Read Derived Figures

```js
import { leaseBalance, dashboardOutstanding, propertyPnL } from '@joelouf/ledger-system';

leaseBalance(store, 'L1').closingCents;        // 80000  ($800 owed: $1,800 charged - $1,000 paid)
dashboardOutstanding(store).totalCents;        // 80000  (sum over every lease)
propertyPnL(store, 'p1', 2026).incomeTotalCents; // 100000 (cash-basis: the payment, not the unpaid charge)
```

### Reconciliation Is Free

```js
// The dashboard total IS the sum of the tenant ledgers, because both are the same fold.
const dash = dashboardOutstanding(store).totalCents;
const sum = store.leases.reduce((acc, l) => acc + Math.max(0, leaseBalance(store, l.id).closingCents), 0);
dash === sum; // always true
```

### Void an Entry

```js
// Soft-delete a line and every derived figure recomputes from the live entries.
store.entries.find((e) => e.id === 'e2').deletedAt = '2026-05-10';
leaseBalance(store, 'L1').closingCents; // 180000 — the payment no longer counts
```

## The Seven Classes

`entryClass` is the only thing that classifies an entry. Every effect below is derived from it at fold time.

| Class | Cash | P&L | AR | Deposit |
|---|---|---|---|---|
| `operating_income` | in | income | — | — |
| `operating_expense` | out | expense | — | — |
| `tenant_charge` | — | — | increase | — |
| `tenant_payment` | in | income | decrease | — |
| `tenant_refund` | out | — | increase | — |
| `deposit_movement` | flex | flex | — | flex |
| `deposit_application` | — | income | decrease | decrease |

For `deposit_movement`, the cash, deposit, and P&L effects depend on the `depositEffect` sub-discriminator (`collect`, `return`, `forfeit`).

## The Fold

Every function below is pure and reads only non-deleted entries.

| Function | Returns |
|---|---|
| `liveEntries(store)` | Every non-deleted entry — the one place deletion is read |
| `replayLeaseLedger(store, leaseId)` | Per-period projection rows with cross-period netting |
| `leaseBalance(store, leaseId)` | The latest closing balance, credit, and status for a lease |
| `dashboardOutstanding(store)` | Total receivable across the portfolio, reconciled to the ledgers |
| `propertyOutstanding(store, propertyId)` | Receivable for one property |
| `propertyPnL(store, propertyId, year)` | Cash-basis income and expense by category for a property/year |
| `portfolioPnL(store, year?)` | Cash-basis P&L across the portfolio |
| `depositLiability(store, leaseId)` | Deposit held for one lease |
| `depositStatus(store, lease)` | `held` / `partially_returned` / `returned` / `forfeit` / `none` |
| `depositRegister(store)` | One row per lease with a required or held deposit |
| `totalDepositLiability(store)` | Total deposit held across the portfolio |
| `contactFeed(store, contactId)` | A contact's participation feed — a list, never a balance |
| `portfolio(store, filters?)` | Every live entry, filterable by class, property, scope, year |
| `chargeSettlement(store, leaseId)` | Per-charge open/paid view; `sum(open) - credit` equals the lease closing |

## Money

```js
import { cents, fmt, allocate, prorateRent } from '@joelouf/ledger-system';

cents(18.50);                    // 1850
fmt(149032);                     // '$1,490.32'
allocate(10000, [1, 1, 1]);      // [3334, 3333, 3333]  — always sums to exactly 10000
prorateRent(210000, 22, 31);     // 149032  — 22 of 31 days, rounded to the nearest cent
```

## Security

This is an auditable financial-correctness core, and several properties are security-relevant by design:

- **No floating-point money** - every amount is an integer number of cents, so a sum can never silently lose or invent a fraction of a cent.
- **A single source of truth** - because every figure is a fold over the same entries, there is no cached balance to tamper with independently; correctness is recomputed, not stored.
- **Bounded amounts** - `MAX_AMOUNT_CENTS` caps a single entry well below `Number.MAX_SAFE_INTEGER`, catching overflow and typo injection before any total can lose precision.
- **No ambient authority** - the engine performs no I/O and reads no global state; it is a pure function of the store you pass in, which makes its behavior fully reproducible and testable in isolation.
- **Append-only** - entries are never edited in place; the live view is a deletion filter, so history is preserved and a correction never destroys what it replaces.

Run the suite and the type-check:

```bash
npm test            # node:test
npm run typecheck   # tsc --checkJs (strict JSDoc verification, dev-only; not shipped)
```

To report a vulnerability, see [SECURITY.md](./SECURITY.md).

## Supply Chain

- **Zero runtime dependencies** — installing this package adds nothing to your dependency tree.
- **No peer dependencies** — it runs anywhere Node >= 18 does.
- **Dev toolchain is type-checking only** — the sole `devDependencies` are `typescript` and `@types/node` (which pulls `undici-types`): three packages, all compiler/type tooling that is never shipped and never installed by consumers. `pnpm audit` reports no known vulnerabilities.
- **Deny-by-default packaging** — the published tarball is an explicit `files` allowlist, so only vetted source, declarations, and `SECURITY.md` ship; tests, config, and CI never leave the repository.
- **Reproducible and pinned** — a committed `pnpm-lock.yaml` locks the dev toolchain by integrity hash, the `packageManager` field pins pnpm itself, and CI runs `pnpm install --frozen-lockfile`, the test suite, `tsc --checkJs`, and `pnpm audit` on every push.
- **Verifiable provenance** — releases are published from CI with `pnpm publish --provenance`, attaching a signed Sigstore / SLSA build attestation that ties each tarball to this repository and commit.

## License

MIT
