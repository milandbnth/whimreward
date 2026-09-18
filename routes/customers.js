import express from "express";
import { randomUUID } from "crypto";
import { pool } from "../db/client.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { name, email = null } = req.body;

    if (!name) {
      return res.status(400).json({
        error: "name is required"
      });
    }

    const id = randomUUID();

    const result = await pool.query(
      `
      INSERT INTO customers (id, name, email)
      VALUES ($1, $2, $3)
      RETURNING id, name, email, created_at
      `,
      [id, name, email]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      error: "Failed to create customer"
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT id, name, email, created_at
      FROM customers
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Customer not found"
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve customer"
    });
  }
});

router.get("/:id/balance", async (req, res) => {
  try {
    const { id } = req.params;

    const customerResult = await pool.query(
      `
      SELECT id
      FROM customers
      WHERE id = $1
      `,
      [id]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({
        error: "Customer not found"
      });
    }

    const balanceResult = await pool.query(
      `
      SELECT COALESCE(SUM(amount), 0)::INTEGER AS balance
      FROM reward_transactions
      WHERE customer_id = $1
      `,
      [id]
    );

    res.json({
      customerId: id,
      balance: balanceResult.rows[0].balance
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve customer balance"
    });
  }
});


router.get("/:id/transactions", async (req, res) => {
  try {
    const { id } = req.params;

    const customerResult = await pool.query(
      `
      SELECT id
      FROM customers
      WHERE id = $1
      `,
      [id]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({
        error: "Customer not found"
      });
    }

    const result = await pool.query(
      `
      SELECT
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
      FROM reward_transactions
      WHERE customer_id = $1
      ORDER BY posted_at ASC, created_at ASC
      `,
      [id]
    );

    res.json({
      customerId: id,
      transactions: result.rows
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve transactions"
    });
  }
});

export default router;