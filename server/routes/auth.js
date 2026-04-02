const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../db/client");
const { requireAuth } = require("../middleware/auth");

/**
 * POST /api/auth/login
 * body: { username, password }
 * response: { token, user: { id, username, role } }
 */
router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "用户名和密码不能为空" });
    }

    const { rows } = await query(
      "SELECT id, username, password, role FROM users WHERE username = $1",
      [username.trim()]
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || "7d" }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * header: Authorization: Bearer <token>
 */
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

/** POST /api/auth/logout - 无状态 JWT，前端清除 token 即可 */
router.post("/logout", (req, res) => res.json({ ok: true }));

module.exports = router;
