import express from "express";
import { randomUUID } from "crypto";
import { pool } from "../db/client.js";
import { requireAuth } from "../auth/require-auth.js";

const router = express.Router();

router.use(requireAuth);


router.get("/", async (req, res) => {
  try {
    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    if (search.length > 100) {
      return res.status(400).json({
        error: "Search query must be 100 characters or fewer"
      });
    }

    const result = await pool.query(
      `
      SELECT
        c.id,
        c.whim_id,
        c.name,
        c.email,
        c.created_at,
        COALESCE(SUM(rt.amount), 0)::INTEGER AS balance
      FROM customers c
      LEFT JOIN reward_transactions rt
        ON rt.customer_id = c.id
      WHERE
        $1 = ''
        OR c.name ILIKE '%' || $1 || '%'
        OR COALESCE(c.email, '') ILIKE '%' || $1 || '%'
      GROUP BY c.id, c.name, c.email, c.created_at
      ORDER BY c.name ASC
      LIMIT 50
      `,
      [search]
    );

    return res.json({
      customers: result.rows
    });
  } catch (error) {
    console.error("Failed to search customers:", error.message);

    return res.status(500).json({
      error: "Failed to search customers"
    });
  }
});


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
      SELECT id, whim_id, name, email, created_at
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