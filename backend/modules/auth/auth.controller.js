const pool = require("../../database/pool");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const { JWT_SECRET } = require("../../config/env");

exports.register = async (req, res) => {
  try {
    const { full_name, email, password, role = "worker" } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email and password are required.",
      });
    }

    const allowedRoles = ["admin", "manager", "worker", "subcontractor"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user role.",
      });
    }

    const userExists = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      `
      INSERT INTO users (full_name, email, password_hash, role, status)
      VALUES ($1, LOWER($2), $3, $4, 'active')
      RETURNING id, full_name, email, role, status
      `,
      [full_name, email, password_hash, role]
    );

    const user = newUser.rows[0];

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user,
    });
  } catch (error) {
    console.error("Register error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { full_name, email, password, role = "worker", status = "active" } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email and password are required.",
      });
    }

    const allowedRoles = ["admin", "manager", "worker", "subcontractor"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user role.",
      });
    }

    const userExists = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `
      INSERT INTO users (full_name, email, password_hash, role, status)
      VALUES ($1, LOWER($2), $3, $4, $5)
      RETURNING id, full_name, email, role, status
      `,
      [full_name, email, password_hash, role, status]
    );

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 30 * 60 * 1000);

    await pool.query(
      `
      UPDATE users
      SET reset_token = $1,
          reset_token_expires = $2
      WHERE email = $3
      `,
      [resetToken, expires, email]
    );

    res.status(200).json({
      success: true,
      message: "Password reset token generated. Check server logs in development.",
      resetToken: process.env.NODE_ENV === "development" ? resetToken : undefined,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, new_password } = req.body;

    const userResult = await pool.query(
      `
      SELECT *
      FROM users
      WHERE reset_token = $1
      AND reset_token_expires > NOW()
      `,
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    const user = userResult.rows[0];

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(new_password, salt);

    await pool.query(
      `
      UPDATE users
      SET password_hash = $1,
          reset_token = NULL,
          reset_token_expires = NULL
      WHERE id = $2
      `,
      [password_hash, user.id]
    );

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password } = req.body;

    const userResult = await pool.query(
      "SELECT * FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = userResult.rows[0];

    const isMatch = await bcrypt.compare(
      current_password,
      user.password_hash
    );

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(new_password, salt);

    await pool.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [newPasswordHash, userId]
    );

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, full_name, email, role, status, created_at
      FROM users
      ORDER BY id DESC
      `
    );

    res.status(200).json({
      success: true,
      users: result.rows,
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { full_name, email, role, status } = req.body;

    const result = await pool.query(
      `
      UPDATE users
      SET full_name = $1,
          email = $2,
          role = $3,
          status = $4
      WHERE id = $5
      RETURNING id, full_name, email, role, status
      `,
      [full_name, email, role, status, userId]
    );

    res.status(200).json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.disableUser = async (req, res) => {
  try {
    const { userId } = req.params;

    await pool.query(
      "UPDATE users SET status = 'inactive' WHERE id = $1",
      [userId]
    );

    res.status(200).json({
      success: true,
      message: "User disabled successfully",
    });
  } catch (error) {
    console.error("Disable user error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const userResult = await pool.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = userResult.rows[0];

    if (user.status === "inactive") {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive. Please contact admin.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};