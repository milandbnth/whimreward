import express from "express";
import { randomUUID } from "crypto";
import { pool } from "../db/client.js";
import { validateRewardTransaction } from "../core/reward-ledger.js";
import { createAuditLog } from "../db/audit.js";
import { requireAuth } from "../auth/require-auth.js";

const router = express.Router();

router.use(requireAuth);




router.post("/", async (req, res) => {
  const {
    customerId,
    amount,
    type,
    reason,
    reference = null,
    relatedTransactionId = null
  } = req.body ?? {};

  const postedBy = req.session.user.id;

  const transaction = {
    id: randomUUID(),
    customerId,
    amount,
    type,
    reason,
    reference,
    postedBy,
    postedAt: new Date().toISOString(),
    relatedTransactionId
  };

  // Validate before opening a database transaction.
  try {
    if (type === "reward" && amount <= 0) {
      return res.status(400).json({
        error: "Reward transactions must have a positive amount"
      });
    }

    if (type === "redemption" && amount >= 0) {
      return res.status(400).json({
        error: "Redemption transactions must have a negative amount"
      });
    }

    validateRewardTransaction(transaction);
  } catch (error) {
    return res.status(400).json({
      error: error.message
    });
  }

  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();

    await client.query("BEGIN");
    transactionStarted = true;

    const customerResult = await client.query(
      "SELECT id FROM customers WHERE id = $1",
      [customerId]
    );

    if (customerResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        error: "Customer not found"
      });
    }

    const result = await client.query(
      `
      INSERT INTO reward_transactions (
        id,
        customer_id,
        amount,
        type,
        reason,
        reference,
        posted_by,
        posted_at,
        related_transaction_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING
        id,
        customer_id,
        amount,
        type,
        reason,
        reference,
        posted_by,
        posted_at,
        related_transaction_id,
        created_at
      `,
      [
        transaction.id,
        transaction.customerId,
        transaction.amount,
        transaction.type,
        transaction.reason,
        transaction.reference,
        transaction.postedBy,
        transaction.postedAt,
        transaction.relatedTransactionId
      ]
    );

    await createAuditLog(client, {
      action: "CREATE_REWARD_TRANSACTION",
      userId: transaction.postedBy,
      customerId: transaction.customerId,
      transactionId: transaction.id,
      details: {
        amount: transaction.amount,
        type: transaction.type,
        reason: transaction.reason,
        reference: transaction.reference
      }
    });

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (client && transactionStarted) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("Failed to create reward transaction:", error.message);

    return res.status(500).json({
      error: "Failed to create reward transaction"
    });
  } finally {
    client?.release();
  }
});


router.post("/:id/correction", async (req, res) => {
  const { id } = req.params;
  const { amount, reason, reference = null } = req.body ?? {};
  const postedBy = req.session.user.id;

  if (!Number.isInteger(amount)) {
    return res.status(400).json({
      error: "Reward points must be a whole number"
    });
  }

  if (amount === 0) {
    return res.status(400).json({
      error: "Reward points cannot be zero"
    });
  }

  if (typeof reason !== "string" || !reason.trim()) {
    return res.status(400).json({
      error: "reason is required"
    });
  }

  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();

    await client.query("BEGIN");
    transactionStarted = true;

    const originalResult = await client.query(
      `
      SELECT id, customer_id
      FROM reward_transactions
      WHERE id = $1
      `,
      [id]
    );

    if (originalResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        error: "Original transaction not found"
      });
    }

    const original = originalResult.rows[0];
    const correctionId = randomUUID();

    const result = await client.query(
      `
      INSERT INTO reward_transactions (
        id,
        customer_id,
        amount,
        type,
        reason,
        reference,
        posted_by,
        posted_at,
        related_transaction_id
      )
      VALUES ($1, $2, $3, 'correction', $4, $5, $6, NOW(), $7)
      RETURNING
        id,
        customer_id,
        amount,
        type,
        reason,
        reference,
        posted_by,
        posted_at,
        related_transaction_id,
        created_at
      `,
      [
        correctionId,
        original.customer_id,
        amount,
        reason.trim(),
        reference,
        postedBy,
        original.id
      ]
    );

    await createAuditLog(client, {
      action: "CREATE_REWARD_CORRECTION",
      userId: postedBy,
      customerId: original.customer_id,
      transactionId: correctionId,
      details: {
        amount,
        type: "correction",
        reason: reason.trim(),
        reference,
        relatedTransactionId: original.id
      }
    });

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (client && transactionStarted) {
      await client.query("ROLLBACK").catch(() => { });
    }

    console.error("Failed to create reward correction:", error.message);

    return res.status(500).json({
      error: "Failed to create reward correction"
    });
  } finally {
    client?.release();
  }
});

export default router;