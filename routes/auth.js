import { Router } from "express";
import { pool } from "../db/client.js";
import { verifyPassword } from "../auth/password.js";

const router = Router();

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

    const result = await pool.query(
      `
      SELECT id, name, email, password_hash, is_active
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [email.trim()]
    );

    const user = result.rows[0];

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
  } catch {
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
