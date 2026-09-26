import express from "express";
import { randomUUID } from "crypto";
import { pool } from "../db/client.js";
import { validateRewardTransaction } from "../core/reward-ledger.js";
import { createAuditLog } from "../db/audit.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const {
        customerId,
        amount,
        type,
        reason,
        reference = null,
        postedBy,
        relatedTransactionId = null
      } = req.body;

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

      validateRewardTransaction(transaction);

      const customerResult = await client.query(
        `
      SELECT id
      FROM customers
      WHERE id = $1
      `,
        [customerId]
      );

      if (customerResult.rows.length === 0) {
        return res.status(404).json({
          error: "Customer not found"
        });
      }

      const userResult = await client.query(
        `
      SELECT id
      FROM users
      WHERE id = $1
      `,
        [postedBy]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          error: "User not found"
        });
      }

      await client.query("BEGIN");

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

      res.status(201).json(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

router.post("/:id/correction", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      amount,
      reason,
      reference = null,
      postedBy
    } = req.body;

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

    if (!reason) {
      return res.status(400).json({
        error: "reason is required"
      });
    }

    if (!postedBy) {
      return res.status(400).json({
        error: "postedBy is required"
      });
    }

    const originalResult = await pool.query(
      `
      SELECT
        id,
        customer_id
      FROM reward_transactions
      WHERE id = $1
      `,
      [id]
    );

    if (originalResult.rows.length === 0) {
      return res.status(404).json({
        error: "Original transaction not found"
      });
    }

    const original = originalResult.rows[0];

    const userResult = await pool.query(
      `
      SELECT id
      FROM users
      WHERE id = $1
      `,
      [postedBy]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    const correctionId = randomUUID();

    const result = await pool.query(
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
        reason,
        reference,
        postedBy,
        original.id
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

export default router;