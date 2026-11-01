import express from "express";
import { randomUUID, timingSafeEqual } from "crypto";
import { pool } from "../db/client.js";
import { getWhimdbPool } from "../db/oracle-client.js";
import { isOracleBackend } from "../db/backend.js";

const router = express.Router();

export function requireWhimstackSecret(req, res, next){
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

  if (isOracleBackend) {
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
  }

  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    // Serialize profile creation attempts for the same email.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [email]
    );

    const existing = await client.query(
      `SELECT id, whim_id, name, email, created_at
       FROM customers
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [email]
    );

    if (existing.rows.length > 0) {
      await client.query("COMMIT");
      transactionStarted = false;


      return res.status(200).json({
        created: false,
        customer: existing.rows[0]
      });
    }

    const id = randomUUID();

    const result = await client.query(
      `INSERT INTO customers (id, name, email)
       VALUES ($1, $2, $3)
       RETURNING id, whim_id, name, email, created_at`,
      [id, name, email]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(201).json({
      created: true,
      customer: result.rows[0]
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Whimstack profile rollback failed:",
          rollbackError.message
        );
      }
    }

    console.error("Whimstack profile creation failed:", error.message);

    return res.status(500).json({
      error: "Failed to create reward profile"
    });
  } finally {
    client?.release();
  }
});

export default router;
