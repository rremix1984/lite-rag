const router = require("express").Router();
const { query } = require("../db/client");
const { requireAuth } = require("../middleware/auth");

/** 自动生成 slug：小写字母数字连接符 */
function toSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || `ws-${Date.now()}`;
}

// 所有路由需要登录
router.use(requireAuth);

/** GET /api/workspaces - 获取知识库列表 */
router.get("/", async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT id, name, slug, description, created_at FROM workspaces ORDER BY created_at ASC"
    );
    res.json({ workspaces: rows });
  } catch (err) { next(err); }
});

/** POST /api/workspaces - 创建知识库 */
router.post("/", async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "知识库名称不能为空" });

    // 冲突时在 slug 后附加随机数确保唱一
    let slug = toSlug(name.trim());
    const { rows: exist } = await query("SELECT id FROM workspaces WHERE slug = $1", [slug]);
    if (exist.length) slug = `${slug}-${Date.now().toString(36)}`;

    const { rows } = await query(
      `INSERT INTO workspaces (name, slug, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, slug, description, created_at`,
      [name.trim(), slug, description?.trim() || null]
    );
    res.status(201).json({ workspace: rows[0] });
  } catch (err) { next(err); }
});

/** GET /api/workspaces/:slug - 获取单个知识库 */
router.get("/:slug", async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT id, name, slug, description, system_prompt, similarity_threshold, top_n, created_at FROM workspaces WHERE slug = $1",
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ error: "知识库不存在" });
    res.json({ workspace: rows[0] });
  } catch (err) { next(err); }
});

/** PUT /api/workspaces/:slug - 更新知识库配置 */
router.put("/:slug", async (req, res, next) => {
  try {
    const { name, description, system_prompt, similarity_threshold, top_n } = req.body;
    const { rows } = await query(
      `UPDATE workspaces
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           system_prompt = COALESCE($3, system_prompt),
           similarity_threshold = COALESCE($4, similarity_threshold),
           top_n = COALESCE($5, top_n),
           updated_at = NOW()
       WHERE slug = $6
       RETURNING id, name, slug, description, system_prompt, similarity_threshold, top_n`,
      [name || null, description || null, system_prompt || null,
       similarity_threshold || null, top_n || null, req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ error: "知识库不存在" });
    res.json({ workspace: rows[0] });
  } catch (err) { next(err); }
});

/** DELETE /api/workspaces/:slug - 删除知识库（联级删除文档和向量） */
router.delete("/:slug", async (req, res, next) => {
  try {
    const { rows } = await query(
      "DELETE FROM workspaces WHERE slug = $1 RETURNING id",
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ error: "知识库不存在" });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
