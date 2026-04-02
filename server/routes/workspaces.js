/**
 * 知识库路由（含文档和对话子路由）
 * Phase 3 实现：知识库 CRUD
 * Phase 4 实现：文档上传/删除/列表
 * Phase 5 实现：流式对话/历史
 */
const router = require("express").Router();

router.get("/ping", (req, res) => res.json({ ok: true, route: "workspaces" }));

module.exports = router;
