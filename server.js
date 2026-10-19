
import express from "express";
import "dotenv/config";
import { pool } from "./db/client.js";
import customerRoutes from "./routes/customers.js";
import transactionRoutes from "./routes/transactions.js";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import authRoutes from "./routes/auth.js";

const app = express();

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required");
}

const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: false
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 8 * 60 * 60 * 1000
    }
  })
);

app.use(express.json());

app.use(express.static("public"));

app.use("/auth", authRoutes);

app.use("/customers", customerRoutes);

app.use("/transactions", transactionRoutes);

app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT 1 AS connected");

    res.json({
      status: "ok",
      database: result.rows[0].connected === 1
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      database: false
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Reward Ledger API running on port ${PORT}`);
});
