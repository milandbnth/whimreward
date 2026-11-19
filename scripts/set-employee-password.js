import "dotenv/config";
import readline from "node:readline";
import { stdin, stdout } from "node:process";
import { getWhimdbPool, closeOraclePools } from "../db/oracle-client.js";
import { hashPassword } from "../auth/password.js";

function ask(prompt) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  return new Promise(resolve => rl.question(prompt, answer => {
    rl.close();
    resolve(answer.trim());
  }));
}

function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
      reject(new Error("Hidden password input requires an interactive terminal"));
      return;
    }

    stdout.write(prompt);
    let value = "";

    const cleanup = () => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    };

    const onData = (key) => {
      if (key === "\u0003") {
        cleanup();
        reject(new Error("Cancelled"));
        return;
      }

      if (key === "\r" || key === "\n") {
        cleanup();
        resolve(value);
        return;
      }

      if (key === "\u007f" || key === "\b") {
        value = value.slice(0, -1);
      } else if (key >= " ") {
        value += key;
      }
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.on("data", onData);
  });
}

let connection;

try {
  const email = await ask("Employee email: ");
  const firstPassword = await askHidden("New password (8+ characters): ");
  const secondPassword = await askHidden("Confirm password: ");

  if (firstPassword !== secondPassword) {
    throw new Error("Passwords do not match");
  }

  const passwordHash = await hashPassword(firstPassword);
  const oraclePool = await getWhimdbPool();
  connection = await oraclePool.getConnection();

  const updateResult = await connection.execute(
    `UPDATE users
     SET password_hash = :passwordHash
     WHERE LOWER(email) = LOWER(:email)
       AND is_active = 1`,
    { passwordHash, email },
    { autoCommit: true }
  );

  if (updateResult.rowsAffected !== 1) {
    throw new Error("No active employee found with that email");
  }

  const userResult = await connection.execute(
    `SELECT id, name, email
     FROM users
     WHERE LOWER(email) = LOWER(:email)`,
    { email }
  );

  const row = userResult.rows?.[0];
  console.log("Password set successfully for:", row?.[2] ?? email);
} catch (error) {
  console.error("Password setup failed:", error.message);
  process.exitCode = 1;
} finally {
  if (connection) {
    await connection.close().catch(() => {});
  }
  await closeOraclePools().catch(() => {});
}