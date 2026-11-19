import express from "express";
import { createHash, randomUUID } from "crypto";
import { validateRewardTransaction } from "../core/reward-ledger.js";
import { createOracleAuditLog } from "../db/audit.js";
import { requireAuth } from "../auth/require-auth.js";
import { getWhimdbPool, getWhimtrxPool } from "../db/oracle-client.js";
import oracledb from "oracledb";

const router = express.Router();
router.use(requireAuth);

function hashIdempotencyRequest(payload) {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

async function findIdempotencyRecord(connection, key) {
  const result = await connection.execute(
    `SELECT request_hash, response_json
     FROM transaction_idempotency
     WHERE idempotency_key = :key`,
    { key },
    {
      fetchInfo: {
        RESPONSE_JSON: { type: oracledb.STRING }
      }
    }
  );

  const row = result.rows?.[0];

  if (!row) return null;

  const responseJson = row[1];

  return {
    requestHash: row[0],
    response: typeof responseJson === "string"
      ? JSON.parse(responseJson)
      : responseJson
  };
}

async function postOracleRewardTransaction(transaction, idempotencyKey) {
  const whimdbPool = await getWhimdbPool();
  const whimtrxPool = await getWhimtrxPool();

  const customerConnection = await whimdbPool.getConnection();

  try {
    const customerResult = await customerConnection.execute(
      `SELECT id FROM customers WHERE id = :id`,
      { id: transaction.customerId }
    );

    if (!customerResult.rows?.length) {
      return { status: 404, body: { error: "Customer not found" } };
    }

    const userResult = await customerConnection.execute(
      `SELECT id FROM users
       WHERE id = :id AND is_active = 1`,
      { id: transaction.postedBy }
    );

    if (!userResult.rows?.length) {
      return { status: 401, body: { error: "Posting user is not active" } };
    }
  } finally {
    await customerConnection.close();
  }

  const connection = await whimtrxPool.getConnection();
  const requestHash = hashIdempotencyRequest({
    customerId: transaction.customerId,
    amount: transaction.amount,
    type: transaction.type,
    reason: transaction.reason,
    reference: transaction.reference,
    postedBy: transaction.postedBy,
    relatedTransactionId: transaction.relatedTransactionId
  });

  try {
    const existing = await findIdempotencyRecord(connection, idempotencyKey);

    if (existing) {
      if (existing.requestHash !== requestHash) {
        return {
          status: 409,
          body: { error: "Idempotency key reused with a different request" }
        };
      }

      return { status: 200, body: existing.response };
    }

    await connection.execute(
      `INSERT INTO reward_transactions (
         id, customer_id, amount, type, reason, reference,
         posted_by, posted_at, related_transaction_id
       ) VALUES (
         :id, :customerId, :amount, :type, :reason, :reference,
         :postedBy, :postedAt, :relatedTransactionId
       )`,
      {
        id: transaction.id,
        customerId: transaction.customerId,
        amount: transaction.amount,
        type: transaction.type,
        reason: transaction.reason,
        reference: transaction.reference,
        postedBy: transaction.postedBy,
        postedAt: new Date(transaction.postedAt),
        relatedTransactionId: transaction.relatedTransactionId
      }
    );

    const result = await connection.execute(
      `SELECT id, customer_id, amount, type, reason, reference,
              posted_by, posted_at, related_transaction_id, created_at
       FROM reward_transactions
       WHERE id = :id`,
      { id: transaction.id }
    );

    const row = result.rows?.[0];

    if (!row) {
      throw new Error("Transaction inserted but could not be retrieved");
    }

    const response = {
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
    };

    await connection.execute(
      `INSERT INTO transaction_idempotency (
         idempotency_key, request_hash, transaction_id, response_json
       ) VALUES (:key, :requestHash, :transactionId, :responseJson)`,
      {
        key: idempotencyKey,
        requestHash,
        transactionId: transaction.id,
        responseJson: JSON.stringify(response)
      }
    );

    await connection.commit();

    try {
      await createOracleAuditLog({
        action: "CREATE_REWARD_TRANSACTION",
        userId: transaction.postedBy,
        customerId: transaction.customerId,
        transactionId: transaction.id,
        details: {
          type: transaction.type,
          amount: transaction.amount,
          reason: transaction.reason,
          reference: transaction.reference,
          idempotencyKey
        }
      });
    } catch (auditError) {
      console.error(
        "Oracle reward transaction committed, but audit logging failed:",
        auditError.message
      );
    }

    return { status: 201, body: response };
  } catch (error) {
    await connection.rollback().catch(() => { });

    // Another request may have won the race for this key.
    if (error.errorNum === 1) {
      const existing = await findIdempotencyRecord(connection, idempotencyKey);

      if (existing?.requestHash === requestHash) {
        return { status: 200, body: existing.response };
      }

      if (existing) {
        return {
          status: 409,
          body: { error: "Idempotency key reused with a different request" }
        };
      }
    }

    throw error;
  } finally {
    await connection.close();
  }
}

async function postOracleCorrection(id, { amount, reason, reference, postedBy }, idempotencyKey) {
  const whimdbPool = await getWhimdbPool();
  const userConnection = await whimdbPool.getConnection();

  try {
    const userResult = await userConnection.execute(
      `SELECT id FROM users WHERE id = :id AND is_active = 1`,
      { id: postedBy }
    );

    if (!userResult.rows?.length) {
      return { status: 401, body: { error: "Posting user is not active" } };
    }
  } finally {
    await userConnection.close();
  }

  const whimtrxPool = await getWhimtrxPool();
  const connection = await whimtrxPool.getConnection();

  const payload = {
    originalTransactionId: id,
    amount,
    reason: reason.trim(),
    reference,
    postedBy
  };

  const requestHash = hashIdempotencyRequest(payload);

  try {
    const existing = await findIdempotencyRecord(connection, idempotencyKey);

    if (existing) {
      if (existing.requestHash !== requestHash) {
        return {
          status: 409,
          body: { error: "Idempotency key reused with a different request" }
        };
      }

      return { status: 200, body: existing.response };
    }

    const originalResult = await connection.execute(
      `SELECT id, customer_id
       FROM reward_transactions
       WHERE id = :id`,
      { id }
    );

    if (!originalResult.rows?.length) {
      return { status: 404, body: { error: "Original transaction not found" } };
    }

    const original = originalResult.rows[0];
    const customerConnection = await whimdbPool.getConnection();

    try {
      const customerResult = await customerConnection.execute(
        `SELECT id FROM customers WHERE id = :id`,
        { id: original[1] }
      );

      if (!customerResult.rows?.length) {
        return { status: 409, body: { error: "Original transaction customer no longer exists" } };
      }
    } finally {
      await customerConnection.close();
    }

    const correctionId = randomUUID();
    const cleanReason = reason.trim();

    await connection.execute(
      `INSERT INTO reward_transactions (
        id, customer_id, amount, type, reason, reference,
        posted_by, posted_at, related_transaction_id
      ) VALUES (
        :id, :customerId, :amount, 'correction', :reason, :reference,
        :postedBy, SYSTIMESTAMP, :relatedTransactionId
      )`,
      {
        id: correctionId,
        customerId: original[1],
        amount,
        reason: cleanReason,
        reference,
        postedBy,
        relatedTransactionId: original[0]
      }
    );

    const result = await connection.execute(
      `SELECT id, customer_id, amount, type, reason, reference,
              posted_by, posted_at, related_transaction_id, created_at
       FROM reward_transactions
       WHERE id = :id`,
      { id: correctionId }
    );

    const row = result.rows?.[0];
    if (!row) throw new Error("Correction inserted but could not be retrieved");

    const response = {
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
    };

    await connection.execute(
      `INSERT INTO transaction_idempotency (
        idempotency_key, request_hash, transaction_id, response_json
      ) VALUES (:key, :requestHash, :transactionId, :responseJson)`,
      {
        key: idempotencyKey,
        requestHash,
        transactionId: correctionId,
        responseJson: JSON.stringify(response)
      }
    );

    await connection.commit();

    try {
      await createOracleAuditLog({
        action: "CREATE_REWARD_CORRECTION",
        userId: postedBy,
        customerId: original[1],
        transactionId: correctionId,
        details: {
          amount,
          reason: cleanReason,
          reference,
          relatedTransactionId: original[0],
          idempotencyKey
        }
      });
    } catch (auditError) {
      console.error(
        "Oracle correction committed, but audit logging failed:",
        auditError.message
      );
    }

    return { status: 201, body: response };
  } catch (error) {
    await connection.rollback().catch(() => { });

    if (error.errorNum === 1) {
      const existing = await findIdempotencyRecord(connection, idempotencyKey);

      if (existing?.requestHash === requestHash) {
        return { status: 200, body: existing.response };
      }

      if (existing) {
        return {
          status: 409,
          body: { error: "Idempotency key reused with a different request" }
        };
      }
    }

    throw error;
  } finally {
    await connection.close();
  }
}

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
  const idempotencyKey = req.get("Idempotency-Key")?.trim();

  if (!idempotencyKey || idempotencyKey.length > 255) {
    return res.status(400).json({
      error: "A valid Idempotency-Key header is required"
    });
  }

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

  try {
    const result = await postOracleRewardTransaction(
      transaction,
      idempotencyKey
    );

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Failed to create Oracle reward transaction:", error.message);

    return res.status(500).json({
      error: "Failed to create reward transaction"
    });
  }
});

router.post("/:id/correction", async (req, res) => {
  const { id } = req.params;
  const { amount, reason, reference = null } = req.body ?? {};
  const postedBy = req.session.user.id;
  const idempotencyKey = req.get("Idempotency-Key")?.trim();

  if (!idempotencyKey || idempotencyKey.length > 255) {
    return res.status(400).json({
      error: "A valid Idempotency-Key header is required"
    });
  }

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

  try {
    const result = await postOracleCorrection(
      id,
      { amount, reason, reference, postedBy },
      idempotencyKey
    );

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Failed to create Oracle reward correction:", error.message);

    return res.status(500).json({
      error: "Failed to create reward correction"
    });
  }
});

export default router;