import { randomUUID } from "crypto";

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