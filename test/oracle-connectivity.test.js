
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import {
  getWhimdbPool,
  getWhimtrxPool,
  closeOraclePools,
} from "../db/oracle-client.js";

const enabled = process.env.RUN_ORACLE_TESTS === "1";

test(
  "Oracle databases connect and required tables exist",
  { skip: !enabled },
  async () => {
    try {
      const checks = [
        {
          label: "WHIMDB",
          getPool: getWhimdbPool,
          tables: ["CUSTOMERS", "USERS", "AUDIT_LOG", "USER_SESSIONS"],
        },
        {
          label: "WHIMTRX",
          getPool: getWhimtrxPool,
          tables: [
            "REWARD_TRANSACTIONS",
            "TRANSACTION_IDEMPOTENCY",
          ],
        },
      ];

      for (const check of checks) {
        const pool = await check.getPool();
        const connection = await pool.getConnection();

        try {
          const ping = await connection.execute("SELECT 1 FROM DUAL");
          assert.equal(ping.rows[0][0], 1, `${check.label} connection`);

          for (const table of check.tables) {
            const result = await connection.execute(
              `SELECT COUNT(*) FROM user_tables WHERE table_name = :table_name`,
              { table_name: table },
            );

            assert.equal(
              result.rows[0][0],
              1,
              `${check.label} table ${table} should exist`,
            );
          }
        } finally {
          await connection.close();
        }
      }
    } finally {
      await closeOraclePools();
    }
  },
);
