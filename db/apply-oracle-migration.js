import "dotenv/config";
import fs from "node:fs";
import { getWhimtrxPool, closeOraclePools } from "./oracle-client.js";

const migrationFile = new URL(
  "./oracle-migration-001-transaction-idempotency.sql",
  import.meta.url
);

let connection;

try {
  const pool = await getWhimtrxPool();
  connection = await pool.getConnection();

  const identity = await connection.execute(
    `SELECT USER FROM DUAL`
  );

  console.log(`Connected to WHIMTRX as: ${identity.rows[0][0]}`);

  const existing = await connection.execute(
    `SELECT table_name
     FROM user_tables
     WHERE table_name = 'TRANSACTION_IDEMPOTENCY'`
  );

  if (existing.rows.length > 0) {
    throw new Error(
      "TRANSACTION_IDEMPOTENCY already exists; refusing to reapply migration."
    );
  }

  const sql = fs.readFileSync(migrationFile, "utf8");

  const statements = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  if (statements.length !== 2) {
    throw new Error(
      `Expected 2 SQL statements but found ${statements.length}.`
    );
  }

  for (const statement of statements) {
    await connection.execute(statement);
  }

  console.log("WHIMTRX idempotency migration applied successfully.");
} catch (error) {
  console.error("Migration failed:", error.code || "", error.message);
  process.exitCode = 1;
} finally {
  if (connection) {
    await connection.close().catch(() => {});
  }

  await closeOraclePools().catch(() => {});
}