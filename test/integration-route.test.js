import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";

process.env.WHIMSTACK_API_SECRET = "local-test-secret-not-for-production";

const { default: integrationRoutes } = await import("../routes/integration.js");
const app = express();
app.use(express.json());
app.use("/integration", integrationRoutes);

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

test("rejects a missing API key", async () => {
  const response = await fetch(`${baseUrl}/integration/profiles`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Test", email: "test@example.com" }),
  });
  assert.equal(response.status, 401);
});

test("rejects an incorrect API key", async () => {
  const response = await fetch(`${baseUrl}/integration/profiles`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": "incorrect-secret",
    },
    body: JSON.stringify({ name: "Test", email: "test@example.com" }),
  });
  assert.equal(response.status, 401);
});

test("rejects invalid profile input before database access", async () => {
  const response = await fetch(`${baseUrl}/integration/profiles`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": "local-test-secret-not-for-production",
    },
    body: JSON.stringify({ name: "", email: "not-an-email" }),
  });
  assert.equal(response.status, 400);
});
