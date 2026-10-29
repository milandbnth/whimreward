import "dotenv/config";
import fs from "node:fs";
import {
  getWhimdbPool,
  getWhimtrxPool,
  closeOraclePools,
} from "./oracle-client.js";

function parseStatements(sql) {
  const statements = [];
  let current = "";
  let inTrigger = false;

  for (const line of sql.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("--")) continue;

    if (/^CREATE\s+OR\s+REPLACE\s+TRIGGER\b/i.test(trimmed)) {
      inTrigger = true;
    }

    if (trimmed === "/") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      inTrigger = false;
      continue;
    }

    current += `${line}\n`;

    if (!inTrigger && trimmed.endsWith(";")) {
      statements.push(current.trim().replace(/;\s*$/, ""));
      current = "";
    }
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

const target = process.argv[2]?.toLowerCase();
const dryRun = process.argv.includes("--dry-run");

const configs = {
  whimdb: {
    getPool: getWhimdbPool,
    file: new URL("./oracle-schema-whimdb.sql", import.meta.url),
  },
  whimtrx: {
    getPool: getWhimtrxPool,
    file: new URL("./oracle-schema-whimtrx.sql", import.meta.url),
  },
};

if (!configs[target]) {
  console.error("Specify exactly one target: whimdb or whimtrx");
  process.exitCode = 1;
} else {
  try {
    const config = configs[target];
    const pool = await config.getPool();
    const connection = await pool.getConnection();


    try {
      if (!dryRun) {
        const existing = await connection.execute(
          `SELECT table_name
           FROM user_tables
           WHERE table_name IN (
             'USERS',
             'CUSTOMERS',
             'AUDIT_LOG',
             'USER_SESSIONS',
             'REWARD_TRANSACTIONS'
           )
           ORDER BY table_name`
        );

        if (existing.rows.length > 0) {
          throw new Error(
            `Target schema already contains WhimReward tables: ${existing.rows.map((row) => row[0]).join(", ")
            }`
          );
        }
      }

      const sql = fs.readFileSync(config.file, "utf8");
      const statements = parseStatements(sql);


      if (dryRun) {
        console.log(`${target.toUpperCase()} schema dry run:`);
        statements.forEach((statement, index) => {
          console.log(`${index + 1}. ${statement.split("\n")[0]}`);
        });
        console.log(`Statements to execute: ${statements.length}`);
      } else {
        for (const statement of statements) {
          await connection.execute(statement);
        }

        console.log(`${target.toUpperCase()} schema applied successfully.`);
        console.log(`Statements executed: ${statements.length}`);
      }

    } finally {
      await connection.close();
    }
  } catch (error) {
    console.error(
      "Schema application failed:",
      error.code || "unknown",
      error.message
    );
    process.exitCode = 1;
  } finally {
    await closeOraclePools().catch(() => { });
  }
}
