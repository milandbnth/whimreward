
import "dotenv/config";

const configuredBackend = "oracle";

const supportedBackends = new Set(["postgres", "oracle"]);

if (!supportedBackends.has(configuredBackend)) {
  throw new Error(
    `Unsupported DATABASE_BACKEND "${configuredBackend}". Use "postgres" or "oracle".`
  );
}

export const databaseBackend = configuredBackend;

export const isOracleBackend = databaseBackend === "oracle";
