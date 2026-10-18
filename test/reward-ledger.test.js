import test from "node:test";
import assert from "node:assert/strict";

import {
  createRewardTransaction,
  calculateRewardBalance,
  getCustomerTransactions,
  createCorrectionTransaction
} from "../core/reward-ledger.js";

test("creates a valid reward transaction", () => {
  const transaction = createRewardTransaction({
    id: "TX001",
    customerId: "C001",
    amount: 1000,
    type: "reward",
    reason: "Purchase reward",
    reference: "INV-1001",
    postedBy: "EMP001"
  });

  assert.equal(transaction.id, "TX001");
  assert.equal(transaction.customerId, "C001");
  assert.equal(transaction.amount, 1000);
  assert.equal(transaction.type, "reward");
  assert.equal(transaction.reason, "Purchase reward");
  assert.equal(transaction.reference, "INV-1001");
  assert.equal(transaction.postedBy, "EMP001");
});

test("rejects fractional reward points", () => {
  assert.throws(
    () =>
      createRewardTransaction({
        id: "TX002",
        customerId: "C001",
        amount: 100.5,
        type: "reward",
        reason: "Test",
        postedBy: "EMP001"
      }),
    {
      message: "Reward points must be a whole number"
    }
  );
});

test("rejects zero reward points", () => {
  assert.throws(
    () =>
      createRewardTransaction({
        id: "TX003",
        customerId: "C001",
        amount: 0,
        type: "reward",
        reason: "Test",
        postedBy: "EMP001"
      }),
    {
      message: "Reward points cannot be zero"
    }
  );
});

test("allows negative whole-number points", () => {
  const transaction = createRewardTransaction({
    id: "TX004",
    customerId: "C001",
    amount: -250,
    type: "redemption",
    reason: "Reward redemption",
    postedBy: "EMP001"
  });

  assert.equal(transaction.amount, -250);
});

test("calculates customer balance from transactions", () => {
  const transactions = [
    createRewardTransaction({
      id: "TX101",
      customerId: "C001",
      amount: 1000,
      type: "reward",
      reason: "Purchase reward",
      postedBy: "EMP001"
    }),
    createRewardTransaction({
      id: "TX102",
      customerId: "C001",
      amount: -250,
      type: "redemption",
      reason: "Reward redemption",
      postedBy: "EMP001"
    }),
    createRewardTransaction({
      id: "TX103",
      customerId: "C002",
      amount: 500,
      type: "reward",
      reason: "Purchase reward",
      postedBy: "EMP001"
    })
  ];

  assert.equal(
    calculateRewardBalance(transactions, "C001"),
    750
  );

  assert.equal(
    calculateRewardBalance(transactions, "C002"),
    500
  );
});


test("does not allow an existing transaction to be modified", () => {
  const transaction = createRewardTransaction({
    id: "TX201",
    customerId: "C001",
    amount: 1000,
    type: "reward",
    reason: "Purchase reward",
    postedBy: "EMP001"
  });

  assert.equal(Object.isFrozen(transaction), true);

  assert.equal(Reflect.set(transaction, "amount", 500), false);

  assert.equal(transaction.amount, 1000);
});

test("creates a correction without modifying the original transaction", () => {
  const original = createRewardTransaction({
    id: "TX301",
    customerId: "C001",
    amount: 1000,
    type: "reward",
    reason: "Purchase reward",
    postedBy: "EMP001"
  });

  const correction = createCorrectionTransaction({
    id: "TX302",
    originalTransaction: original,
    amount: -100,
    reason: "Reward adjusted from 1000 to 900",
    reference: "CORR-001",
    postedBy: "EMP001"
  });

  assert.equal(original.amount, 1000);
  assert.equal(original.type, "reward");

  assert.equal(correction.amount, -100);
  assert.equal(correction.type, "correction");
  assert.equal(correction.relatedTransactionId, "TX301");
  assert.equal(correction.customerId, "C001");

  assert.equal(
    calculateRewardBalance([original, correction], "C001"),
    900
  );
});

test("returns only transactions belonging to the requested customer", () => {
  const transactions = [
    createRewardTransaction({
      id: "TX401",
      customerId: "C001",
      amount: 1000,
      type: "reward",
      reason: "Purchase reward",
      postedBy: "EMP001"
    }),
    createRewardTransaction({
      id: "TX402",
      customerId: "C002",
      amount: 500,
      type: "reward",
      reason: "Purchase reward",
      postedBy: "EMP001"
    }),
    createRewardTransaction({
      id: "TX403",
      customerId: "C001",
      amount: -200,
      type: "redemption",
      reason: "Reward redemption",
      postedBy: "EMP001"
    })
  ];

  const customerTransactions =
    getCustomerTransactions(transactions, "C001");

  assert.equal(customerTransactions.length, 2);
  assert.equal(customerTransactions[0].id, "TX401");
  assert.equal(customerTransactions[1].id, "TX403");
});