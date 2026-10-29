
import { Router } from "express";
import { pool } from "../db/client.js";
import { getWhimdbPool } from "../db/oracle-client.js";
import { isOracleBackend } from "../db/backend.js";
import { verifyPassword } from "../auth/password.js";

const router = Router();

async function findUserByEmail(email) {
  if (!isOracleBackend) {
    const result = await pool.query(
      `
      SELECT id, name, email, password_hash, is_active
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [email]
    );

    return result.rows[0] ?? null;
  }

  const oraclePool = await getWhimdbPool();
  const connection = await oraclePool.getConnection();

  try {
    const result = await connection.execute(
      `
      SELECT
        id AS "id",
        name AS "name",
        email AS "email",
        password_hash AS "password_hash",
        is_active AS "is_active"
      FROM users
      WHERE LOWER(email) = LOWER(:email)
      FETCH FIRST 1 ROWS ONLY
      `,
      { email }
    );

    const row = result.rows?.[0];
    if (!row) return null;

    return {
      id: row[0],
      name: row[1],
      email: row[2],
      password_hash: row[3],
      is_active: row[4]
    };
  } finally {
    await connection.close();
  }
}

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        error: "Email and password are required"
      });
    }

    const user = await findUserByEmail(email.trim());

    if (
      !user ||
      !user.is_active ||
      !(await verifyPassword(password, user.password_hash))
    ) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    req.session.regenerate((error) => {
      if (error) {
        return res.status(500).json({
          error: "Unable to create session"
        });
      }

      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email
      };

      req.session.save((saveError) => {
        if (saveError) {
          return res.status(500).json({
            error: "Unable to save session"
          });
        }

        return res.json({
          message: "Login successful",
          user: req.session.user
        });
      });
    });
  } catch (error) {
    console.error("Login failed:", error.message);

    return res.status(500).json({
      error: "Unable to process login"
    });
  }
});

router.get("/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      error: "Not authenticated"
    });
  }

  return res.json({
    user: req.session.user
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        error: "Unable to log out"
      });
    }

    res.clearCookie("connect.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });

    return res.json({
      message: "Logout successful"
    });
  });
});

export default router;
