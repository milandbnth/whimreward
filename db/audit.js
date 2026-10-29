import { randomUUID } from "crypto";
import oracledb from "oracledb";
import { getWhimdbPool } from "./oracle-client.js";

export async function createAuditLog(
  client,
  {
    action,
    userId = null,
    customerId = null,
    transactionId = null,
    details = null
  }
) {
  const id = randomUUID();

  const result = await client.query(
    `
    INSERT INTO audit_log (
      id,
      action,
      user_id,
      customer_id,
      transaction_id,
      details
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING
      id,
      action,
      user_id,
      customer_id,
      transaction_id,
      details,
      created_at
    `,
    [
      id,
      action,
      userId,
      customerId,
      transactionId,
      details
    ]
  );

  return result.rows[0];
}

export async function createOracleAuditLog({
  action,
  userId = null,
  customerId = null,
  transactionId = null,
  details = null
}) {
  const oraclePool = await getWhimdbPool();
  const connection = await oraclePool.getConnection();

  try {
    const id = randomUUID();

    await connection.execute(
      `INSERT INTO audit_log (
        id,
        action,
        user_id,
        customer_id,
        transaction_id,
        details
      ) VALUES (
        :id,
        :action,
        :userId,
        :customerId,
        :transactionId,
        :details
      )`,
      {
        id,
        action,
        userId,
        customerId,
        transactionId,
        details: details == null
          ? null
          : JSON.stringify(details)
      },
      { autoCommit: true }
    );

    return { id, action, user_id: userId, customer_id: customerId, transaction_id: transactionId };
  } finally {
    await connection.close();
  }
}