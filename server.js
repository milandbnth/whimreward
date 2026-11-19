import express from "express";
import "dotenv/config";
import customerRoutes from "./routes/customers.js";
import transactionRoutes from "./routes/transactions.js";
import session from "express-session";
import authRoutes from "./routes/auth.js";
import integrationRoutes from "./routes/integration.js";
import { OracleSessionStore } from "./db/oracle-session-store.js";
import { getWhimdbPool, getWhimtrxPool, closeOraclePools } from "./db/oracle-client.js";

const app = express();

// 1. Trust proxy so Express correctly handles secure headers behind Nginx
app.set("trust proxy", 1);

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required");
}

const sessionStore = new OracleSessionStore();

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    }
  })
);

app.use(express.json());

app.use(express.static("public"));

app.use("/auth", authRoutes);

app.use("/integration", integrationRoutes);

app.use("/customers", customerRoutes);

app.use("/transactions", transactionRoutes);

app.get("/health", async (req, res) => {
  try {
    const whimdbPool = await getWhimdbPool();
    const whimtrxPool = await getWhimtrxPool();

    const customerConnection = await whimdbPool.getConnection();
    const transactionConnection = await whimtrxPool.getConnection();

    try {
      await customerConnection.execute("SELECT 1 FROM DUAL");
      await transactionConnection.execute("SELECT 1 FROM DUAL");
    } finally {
      await Promise.all([
        customerConnection.close(),
        transactionConnection.close()
      ]);
    }

    return res.json({
      status: "ok",
      database: true,
      backend: "oracle",
      databases: {
        whimdb: true,
        whimtrx: true
      }
    });
  } catch (error) {
    console.error("Health check failed:", error.message);

    return res.status(500).json({
      status: "error",
      database: false
    });
  }
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Reward Ledger API running on port ${PORT}`);
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`Received ${signal}; shutting down...`);

  server.close(async () => {
    try {
      await closeOraclePools();
      console.log("Database pools closed.");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error.message);
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));