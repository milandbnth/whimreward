import express from "express";
import { randomUUID, timingSafeEqual } from "crypto";
import { getWhimdbPool, getWhimtrxPool } from "../db/oracle-client.js";

const router = express.Router();

export function requireWhimstackSecret(req, res, next) {
  const expected = process.env.WHIMSTACK_API_SECRET;
  const supplied = req.get("x-api-key");

  if (!expected || !supplied) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);

  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

router.use(requireWhimstackSecret);

async function createOracleCustomer({ name, email }) {
  const oraclePool = await getWhimdbPool();
  const connection = await oraclePool.getConnection();

  const readCustomer = async () => {
    const result = await connection.execute(
      `SELECT
         id,
         whim_id,
         name,
         email,
         created_at
       FROM customers
       WHERE LOWER(email) = :email
       FETCH FIRST 1 ROWS ONLY`,
      { email }
    );

    const row = result.rows?.[0];

    if (!row) return null;

    return {
      id: row[0],
      whim_id: row[1],
      name: row[2],
      email: row[3],
      created_at: row[4]
    };
  };

  try {
    const existing = await readCustomer();

    if (existing) {
      return { created: false, customer: existing };
    }

    const id = randomUUID();

    try {
      await connection.execute(
        `INSERT INTO customers (id, name, email)
         VALUES (:id, :name, :email)`,
        { id, name, email },
        { autoCommit: true }
      );
    } catch (error) {
      // ORA-00001: a concurrent request may have inserted this email.
      if (error.errorNum !== 1) throw error;

      const customer = await readCustomer();
      if (customer) return { created: false, customer };

      throw error;
    }

    const customer = await readCustomer();

    if (!customer) {
      throw new Error("Customer was inserted but could not be retrieved");
    }

    return { created: true, customer };
  } finally {
    await connection.close();
  }
}

router.post("/profiles", async (req, res) => {
  const name =
    typeof req.body.name === "string" ? req.body.name.trim() : "";

  const email =
    typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";

  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: "A valid name and email are required"
    });
  }

  try {
    const result = await createOracleCustomer({ name, email });

    return res.status(result.created ? 201 : 200).json(result);
  } catch (error) {
    console.error(
      "Oracle profile creation failed:",
      error.message
    );

    return res.status(500).json({
      error: "Failed to create reward profile"
    });
  }
});

router.get("/customers/balance", async (req, res) => {
  const identifier =
    typeof req.query.identifier === "string"
      ? req.query.identifier.trim().toLowerCase()
      : "";

  if (!identifier) {
    return res.status(400).json({
      error: "identifier query parameter is required"
    });
  }

  if (identifier.length > 100) {
    return res.status(400).json({
      error: "identifier must be 100 characters or fewer"
    });
  }

  try {
    const whimdbPool = await getWhimdbPool();
    const customerConn = await whimdbPool.getConnection();
    let customer;

    try {
      const result = await customerConn.execute(
        `SELECT id, whim_id, name, email
         FROM customers
         WHERE LOWER(email) = :identifier
            OR LOWER(TO_CHAR(whim_id)) = :identifier
            OR LOWER(id) = :identifier
         FETCH FIRST 1 ROWS ONLY`,
        { identifier }
      );

      const row = result.rows?.[0];

      if (!row) {
        return res.status(404).json({
          error: "Customer not found in WhimReward"
        });
      }

      customer = {
        id: row[0],
        whim_id: row[1],
        name: row[2],
        email: row[3]
      };
    } finally {
      await customerConn.close();
    }

    const whimtrxPool = await getWhimtrxPool();
    const trxConn = await whimtrxPool.getConnection();

    try {
      const balResult = await trxConn.execute(
        `SELECT NVL(SUM(amount), 0)
         FROM reward_transactions
         WHERE customer_id = :id`,
        { id: customer.id }
      );

      return res.json({
        customer,
        balance: Number(balResult.rows?.[0]?.[0] ?? 0)
      });
    } finally {
      await trxConn.close();
    }
  } catch (error) {
    console.error("Integration balance lookup failed:", error.message);

    return res.status(500).json({
      error: "Failed to retrieve customer balance"
    });
  }
});

export default router;