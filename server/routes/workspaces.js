const router   = require("express").Router();
const crypto   = require("crypto");
const { v4: uuidv4 } = require("uuid");
const { query }       = require("../db/client");
const { requireAuth } = require("../middleware/auth");
const { upload }      = require("../middleware/upload");
const { parseFile }   = require("../services/parser");
const { splitText }   = require("../services/chunker");
const { embedTexts }  = require("../services/embedding");
const { addVectors, deleteByDocIds } = require("../services/vectordb");
const { streamChat }  = require("../services/llm");
const { buildRAGContext, getRecentHistory, buildMessages } = require("../services/rag");
const { initSSE, pipeStreamToSSE, writeTextResponse } = require("../utils/stream");
const logger = require("../utils/logger");

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

// ─── 文档子路由 ───────────────────────────────────────────────────────────────

/** GET /api/workspaces/:slug/documents - 列出已上传文档（按文件名汇总） */
router.get("/:slug/documents", async (req, res, next) => {
  try {
    const { rows: ws } = await query("SELECT id FROM workspaces WHERE slug=$1", [req.params.slug]);
    if (!ws.length) return res.status(404).json({ error: "知识库不存在" });

    const { rows } = await query(
      `SELECT filename, file_hash,
              COUNT(*) AS chunk_count,
              MAX(created_at) AS created_at
       FROM documents
       WHERE workspace_id = $1
       GROUP BY filename, file_hash
       ORDER BY MAX(created_at) ASC`,
      [ws[0].id]
    );
    res.json({ documents: rows });
  } catch (err) { next(err); }
});

/**
 * POST /api/workspaces/:slug/documents
 * 上传 → 解析 → 分块 → Embedding → 存库
 * 耗时较长，前端需处理超时
 */
router.post(
  "/:slug/documents",
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: "请选择要上传的文件" });

      const { rows: ws } = await query(
        "SELECT id FROM workspaces WHERE slug=$1", [req.params.slug]
      );
      if (!ws.length) return res.status(404).json({ error: "知识库不存在" });
      const workspaceId = ws[0].id;

      // 计算文件 hash，相同文件不重复入库
      const fileHash = crypto.createHash("md5").update(req.file.buffer).digest("hex");
      const { rows: existing } = await query(
        "SELECT id FROM documents WHERE workspace_id=$1 AND file_hash=$2 LIMIT 1",
        [workspaceId, fileHash]
      );
      if (existing.length) {
        return res.json({ ok: true, message: "该文件已存在，跳过重复上传", skipped: true });
      }

      logger.info(`处理文件: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);

      // 1. 解析文本
      const text = await parseFile(req.file);
      if (!text.trim()) return res.status(400).json({ error: "文件内容为空或无法解析" });

      // 2. 分块
      const chunks = splitText(text);
      if (!chunks.length) return res.status(400).json({ error: "文本分块失败" });
      logger.info(`分块完成: ${chunks.length} 个 chunk`);

      // 3. 写入 documents 表
      const insertedIds = [];
      for (let i = 0; i < chunks.length; i++) {
        const { rows } = await query(
          `INSERT INTO documents (workspace_id, filename, file_hash, chunk_index, content, metadata)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [workspaceId, req.file.originalname, fileHash, i, chunks[i],
           JSON.stringify({ chunk_index: i, total_chunks: chunks.length })]
        );
        insertedIds.push(rows[0].id);
      }

      // 4. Embedding
      logger.info(`开始 Embedding ${chunks.length} 个 chunk...`);
      const embeddings = await embedTexts(chunks);

      // 5. 写入向量表
      await addVectors({ docIds: insertedIds, workspaceId, embeddings });
      logger.info(`文件 ${req.file.originalname} 处理完成`);

      res.json({
        ok: true,
        filename:    req.file.originalname,
        chunk_count: chunks.length,
      });
    } catch (err) {
      // multer 错误（文件类型/大小）直接返回 400
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: `文件超过大小限制 ${process.env.MAX_UPLOAD_SIZE_MB || 50} MB` });
      }
      next(err);
    }
  }
);

/** DELETE /api/workspaces/:slug/documents/:filename - 删除文档及其向量 */
router.delete("/:slug/documents/:filename", async (req, res, next) => {
  try {
    const { rows: ws } = await query("SELECT id FROM workspaces WHERE slug=$1", [req.params.slug]);
    if (!ws.length) return res.status(404).json({ error: "知识库不存在" });

    const filename = decodeURIComponent(req.params.filename);
    const { rows: docs } = await query(
      "SELECT id FROM documents WHERE workspace_id=$1 AND filename=$2",
      [ws[0].id, filename]
    );
    if (!docs.length) return res.status(404).json({ error: "文档不存在" });

    const docIds = docs.map((d) => d.id);
    await deleteByDocIds(docIds);
    await query(
      "DELETE FROM documents WHERE workspace_id=$1 AND filename=$2",
      [ws[0].id, filename]
    );

    res.json({ ok: true, deleted: docIds.length });
  } catch (err) { next(err); }
});

// ─── Chat 子路由 ───────────────────────────────────────────────────────────────

/**
 * POST /api/workspaces/:slug/chat
 * SSE 流式 RAG 对话接口
 */
router.post("/:slug/chat", async (req, res, next) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "消息不能为空" });

  try {
    const { rows: ws } = await query(
      "SELECT id, name, slug, system_prompt, similarity_threshold, top_n FROM workspaces WHERE slug=$1",
      [req.params.slug]
    );
    if (!ws.length) return res.status(404).json({ error: "知识库不存在" });
    const workspace = ws[0];

    // 建立 SSE 连接
    initSSE(res);
    const uuid = uuidv4();

    // 1. RAG 检索
    const { contextText, sources } = await buildRAGContext({
      workspaceId:  workspace.id,
      userMessage:  message.trim(),
      topN:         workspace.top_n || 4,
      threshold:    workspace.similarity_threshold || 0.25,
    });

    // 2. 历史消息
    const history = await getRecentHistory({ workspaceId: workspace.id, userId: req.user.id });

    // 3. 组装 messages
    const messages = buildMessages({ workspace, userMessage: message.trim(), contextText, history });

    // 4. 流式 LLM
    const stream    = await streamChat(messages);
    const fullText  = await pipeStreamToSSE(res, stream, { uuid, sources });

    // 5. 存入 chats 表
    await query(
      "INSERT INTO chats (workspace_id, user_id, role, content, sources) VALUES ($1,$2,$3,$4,$5)",
      [workspace.id, req.user.id, "user", message.trim(), "[]"]
    );
    await query(
      "INSERT INTO chats (workspace_id, user_id, role, content, sources) VALUES ($1,$2,$3,$4,$5)",
      [workspace.id, req.user.id, "assistant", fullText, JSON.stringify(sources)]
    );

    res.end();
  } catch (err) {
    logger.error(`chat error: ${err.message}`);
    try {
      writeTextResponse(res, { uuid: uuidv4(), text: null, error: err.message });
      res.end();
    } catch { /* response already ended */ }
    if (!res.headersSent) next(err);
  }
});

/** GET /api/workspaces/:slug/chats - 对话历史 */
router.get("/:slug/chats", async (req, res, next) => {
  try {
    const { rows: ws } = await query("SELECT id FROM workspaces WHERE slug=$1", [req.params.slug]);
    if (!ws.length) return res.status(404).json({ error: "知识库不存在" });

    const { rows } = await query(
      `SELECT id, role, content, sources, created_at
       FROM chats WHERE workspace_id=$1 AND (user_id=$2 OR user_id IS NULL)
       ORDER BY created_at ASC`,
      [ws[0].id, req.user.id]
    );
    res.json({ chats: rows });
  } catch (err) { next(err); }
});

/** DELETE /api/workspaces/:slug/chats - 清空历史 */
router.delete("/:slug/chats", async (req, res, next) => {
  try {
    const { rows: ws } = await query("SELECT id FROM workspaces WHERE slug=$1", [req.params.slug]);
    if (!ws.length) return res.status(404).json({ error: "知识库不存在" });
    await query("DELETE FROM chats WHERE workspace_id=$1 AND user_id=$2", [ws[0].id, req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
