import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const backendModule = new URL("../db/backend.js", import.meta.url).href;

function runBackendSelector(databaseBackend) {
  const env = { ...process.env };
  delete env.DATABASE_BACKEND;

  if (databaseBackend !== undefined) {
    env.DATABASE_BACKEND = databaseBackend;
  }

  return spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { databaseBackend, isOracleBackend } from ${JSON.stringify(backendModule)}; console.log(JSON.stringify({ databaseBackend, isOracleBackend }));`,
    ],
    {
      encoding: "utf8",
      env,
    }
  );
}

test("always selects Oracle when DATABASE_BACKEND is unset", () => {
  const result = runBackendSelector(undefined);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    databaseBackend: "oracle",
    isOracleBackend: true,
  });
});

test("always selects Oracle when DATABASE_BACKEND is configured", () => {
  for (const configuredValue of ["oracle", "postgres", "  ORACLE  "]) {
    const result = runBackendSelector(configuredValue);

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
      databaseBackend: "oracle",
      isOracleBackend: true,
    });
  }
});