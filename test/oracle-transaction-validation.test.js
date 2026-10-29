import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";

process.env.DATABASE_BACKEND = "oracle";

const { default: transactionRoutes } = await import("../routes/transactions.js");

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.session = { user: { id: "validation-test-user" } };
  next();
});
app.use("/transactions", transactionRoutes);

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve())
    );
  }
});

test("rejects reward posting without an idempotency key", async () => {
  const response = await fetch(`${baseUrl}/transactions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      customerId: "test-customer",
      amount: 10,
      type: "reward",
      reason: "test"
    })
  });

  assert.equal(response.status, 400);
  assert.match(JSON.stringify(await response.json()), /Idempotency-Key/);
});

test("rejects invalid reward amount before database access", async () => {
  const response = await fetch(`${baseUrl}/transactions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Idempotency-Key": "validation-test-reward"
    },
    body: JSON.stringify({
      customerId: "test-customer",
      amount: 0,
      type: "reward",
      reason: "test"
    })
  });

  assert.equal(response.status, 400);
});

test("rejects corrections without an idempotency key", async () => {
  const response = await fetch(
    `${baseUrl}/transactions/test-transaction/correction`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: 1, reason: "test" })
    }
  );

  assert.equal(response.status, 400);
  assert.match(JSON.stringify(await response.json()), /Idempotency-Key/);
});

test("rejects zero-point corrections before database access", async () => {
  const response = await fetch(
    `${baseUrl}/transactions/test-transaction/correction`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": "validation-test-correction"
      },
      body: JSON.stringify({ amount: 0, reason: "test" })
    }
  );

  assert.equal(response.status, 400);
});
