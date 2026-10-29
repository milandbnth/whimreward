import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import {
  getWhimdbPool,
  closeOraclePools,
} from "../db/oracle-client.js";

const enabled = process.env.RUN_ORACLE_PROFILE_TESTS === "1";
const email = `oracle-route-test-${randomUUID()}@example.invalid`;
const secret = `test-${randomUUID()}`;

test(
  "Oracle profile creation is idempotent and cleans up its test customer",
  { skip: !enabled },
  async () => {
    process.env.WHIMSTACK_API_SECRET = secret;

    const { default: integrationRoutes } =
      await import("../routes/integration.js");

    const app = express();
    app.use(express.json());
    app.use("/integration", integrationRoutes);

    let server;
    let customerId;

    try {
      const oraclePool = await getWhimdbPool();
      const connection = await oraclePool.getConnection();

      try {
        const existing = await connection.execute(
          "SELECT id FROM customers WHERE LOWER(email) = :email",
          { email },
        );
        assert.equal(existing.rows.length, 0, "test email must be unused");
      } finally {
        await connection.close();
      }

      server = app.listen(0, "127.0.0.1");
      await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
      });

      const url = `http://127.0.0.1:${server.address().port}/integration/profiles`;
      const request = () =>
        fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": secret,
          },
          body: JSON.stringify({
            name: "Temporary Oracle Route Test",
            email,
          }),
        });

      const firstResponse = await request();
      assert.equal(firstResponse.status, 201);
      const first = /** @type {any} */ (await firstResponse.json());
      assert.equal(first.created, true);
      assert.ok(first.customer.id);
      assert.ok(first.customer.whim_id !== null &&
        first.customer.whim_id !== undefined);
      customerId = first.customer.id;

      const secondResponse = await request();
      assert.equal(secondResponse.status, 200);
      const second = /** @type {any} */ (await secondResponse.json());
      assert.equal(second.created, false);
      assert.equal(second.customer.id, first.customer.id);
      assert.equal(
        String(second.customer.whim_id),
        String(first.customer.whim_id),
      );
    } finally {
      if (server) {
        await new Promise((resolve, reject) =>
          server.close((error) => error ? reject(error) : resolve()),
        );
      }

      {
        const oraclePool = await getWhimdbPool();
        const connection = await oraclePool.getConnection();

        try {
          await connection.execute(
            "DELETE FROM customers WHERE LOWER(email) = :email",
            { email },
            { autoCommit: true },
          );

          const check = await connection.execute(
            "SELECT COUNT(*) FROM customers WHERE LOWER(email) = :email",
            { email },
          );
          assert.equal(check.rows[0][0], 0, "test customer must be removed");
        } finally {
          await connection.close();
        }
      }

      await closeOraclePools();
    }
  },
);
