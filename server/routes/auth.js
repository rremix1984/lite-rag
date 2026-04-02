/**
 * 认证路由
 * Phase 2 实现：POST /api/auth/login, GET /api/auth/me
 */
const router = require("express").Router();

router.get("/ping", (req, res) => res.json({ ok: true, route: "auth" }));

module.exports = router;
