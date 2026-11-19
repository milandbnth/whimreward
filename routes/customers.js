import express from "express";
import { randomUUID } from "crypto";
import { requireAuth } from "../auth/require-auth.js";
import { getWhimdbPool, getWhimtrxPool } from "../db/oracle-client.js";

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

    const whimdbPool = await getWhimdbPool();
    const whimtrxPool = await getWhimtrxPool();

    const customerConnection = await whimdbPool.getConnection();

    let customers;

    try {
      const result = await customerConnection.execute(
        `SELECT id, whim_id, name, email, created_at
         FROM customers
         WHERE :search IS NULL
            OR LOWER(name) LIKE '%' || LOWER(:search) || '%'
            OR LOWER(NVL(email, '')) LIKE '%' || LOWER(:search) || '%'
         ORDER BY name ASC
         FETCH FIRST 50 ROWS ONLY`,
        { search }
      );

      customers = (result.rows ?? []).map((row) => ({
        id: row[0],
        whim_id: row[1],
        name: row[2],
        email: row[3],
        created_at: row[4],
        balance: 0
      }));
    } finally {
      await customerConnection.close();
    }

    if (customers.length > 0) {
      const transactionConnection = await whimtrxPool.getConnection();

      try {
        const binds = {};
        const placeholders = customers.map((customer, index) => {
          binds[`id${index}`] = customer.id;
          return `:${`id${index}`}`;
        });

        const result = await transactionConnection.execute(
          `SELECT customer_id, SUM(amount)
           FROM reward_transactions
           WHERE customer_id IN (${placeholders.join(", ")})
           GROUP BY customer_id`,
          binds
        );

        const balances = new Map(
          (result.rows ?? []).map((row) => [row[0], Number(row[1])])
        );

        for (const customer of customers) {
          customer.balance = balances.get(customer.id) ?? 0;
        }
      } finally {
        await transactionConnection.close();
      }
    }

    return res.json({ customers });
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

    const oraclePool = await getWhimdbPool();
    const connection = await oraclePool.getConnection();

    try {
      const id = randomUUID();

      await connection.execute(
        `INSERT INTO customers (id, name, email)
         VALUES (:id, :name, :email)`,
        { id, name, email },
        { autoCommit: true }
      );

      const result = await connection.execute(
        `SELECT id, whim_id, name, email, created_at
         FROM customers
         WHERE id = :id`,
        { id }
      );

      const row = result.rows?.[0];

      if (!row) {
        throw new Error("Customer inserted but could not be retrieved");
      }

      return res.status(201).json({
        id: row[0],
        whim_id: row[1],
        name: row[2],
        email: row[3],
        created_at: row[4]
      });
    } finally {
      await connection.close();
    }
  } catch (error) {
    if (error.errorNum === 1) {
      return res.status(409).json({
        error: "A customer with this email already exists"
      });
    }

    res.status(500).json({
      error: "Failed to create customer"
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const oraclePool = await getWhimdbPool();
    const connection = await oraclePool.getConnection();

    try {
      const result = await connection.execute(
        `SELECT id, whim_id, name, email, created_at
         FROM customers
         WHERE id = :id`,
        { id }
      );

      const row = result.rows?.[0];

      if (!row) {
        return res.status(404).json({
          error: "Customer not found"
        });
      }

      return res.json({
        id: row[0],
        whim_id: row[1],
        name: row[2],
        email: row[3],
        created_at: row[4]
      });
    } finally {
      await connection.close();
    }
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve customer"
    });
  }
});

router.get("/:id/balance", async (req, res) => {
  try {
    const { id } = req.params;
    const whimdbPool = await getWhimdbPool();
    const customerConnection = await whimdbPool.getConnection();

    try {
      const customerResult = await customerConnection.execute(
        `SELECT id FROM customers WHERE id = :id`,
        { id }
      );

      if (!customerResult.rows?.length) {
        return res.status(404).json({
          error: "Customer not found"
        });
      }
    } finally {
      await customerConnection.close();
    }

    const whimtrxPool = await getWhimtrxPool();
    const transactionConnection = await whimtrxPool.getConnection();

    try {
      const balanceResult = await transactionConnection.execute(
        `SELECT NVL(SUM(amount), 0)
         FROM reward_transactions
         WHERE customer_id = :id`,
        { id }
      );

      return res.json({
        customerId: id,
        balance: Number(balanceResult.rows?.[0]?.[0] ?? 0)
      });
    } finally {
      await transactionConnection.close();
    }
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve customer balance"
    });
  }
});

router.get("/:id/transactions", async (req, res) => {
  try {
    const { id } = req.params;
    const whimdbPool = await getWhimdbPool();
    const customerConnection = await whimdbPool.getConnection();

    try {
      const customerResult = await customerConnection.execute(
        `SELECT id FROM customers WHERE id = :id`,
        { id }
      );

      if (!customerResult.rows?.length) {
        return res.status(404).json({
          error: "Customer not found"
        });
      }
    } finally {
      await customerConnection.close();
    }

    const whimtrxPool = await getWhimtrxPool();
    const transactionConnection = await whimtrxPool.getConnection();

    try {
      const result = await transactionConnection.execute(
        `SELECT
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
         WHERE customer_id = :id
         ORDER BY posted_at ASC, created_at ASC`,
        { id }
      );

      const transactions = (result.rows ?? []).map((row) => ({
        id: row[0],
        customer_id: row[1],
        amount: Number(row[2]),
        type: row[3],
        reason: row[4],
        reference: row[5],
        posted_by: row[6],
        posted_at: row[7],
        related_transaction_id: row[8],
        created_at: row[9]
      }));

      return res.json({
        customerId: id,
        transactions
      });
    } finally {
      await transactionConnection.close();
    }
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve transactions"
    });
  }
});

export default router;