
import express from "express";
import "dotenv/config";
import { pool } from "./db/client.js";
import customerRoutes from "./routes/customers.js";
import transactionRoutes from "./routes/transactions.js";

const app = express();

app.use(express.json());

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
