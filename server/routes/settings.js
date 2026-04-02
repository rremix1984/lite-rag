/**
 * 系统配置路由
 * Phase 6 实现：GET/PUT /api/settings
 */
const router = require("express").Router();

router.get("/ping", (req, res) => res.json({ ok: true, route: "settings" }));

module.exports = router;
