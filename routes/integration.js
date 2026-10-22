import express from "express";
import { randomUUID, timingSafeEqual } from "crypto";
import { pool } from "../db/client.js";

const router = express.Router();

function requireWhimstackSecret(req, res, next) {
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
