const router   = require("express").Router();
const crypto   = require("crypto");
const fs       = require("fs/promises");
const path     = require("path");
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

function maybeDecodeLatin1Filename(name) {
  if (!name) return name;
  if (/[\u3400-\u9fff]/.test(name) && !/[ÃÂâæçéå]/.test(name)) return name;
  if (!/[ÃÂâæçéå]/.test(name)) return name;
  try {
    const decoded = Buffer.from(name, "latin1").toString("utf8");
    return decoded || name;
  } catch {
    return name;
  }
}

function getStorageDir(workspaceId) {
  return path.join(__dirname, "..", "storage", "workspaces", String(workspaceId));
}

async function saveUploadedFile({ workspaceId, fileHash, originalName, buffer }) {
  const ext = (path.extname(originalName || "").toLowerCase() || ".bin").replace(/[^.\w-]/g, "");
  const filename = `${fileHash}${ext}`;
  const dir = getStorageDir(workspaceId);
  await fs.mkdir(dir, { recursive: true });
  const absolutePath = path.join(dir, filename);
  await fs.writeFile(absolutePath, buffer);
  return {
    absolutePath,
    relativePath: path.relative(path.join(__dirname, ".."), absolutePath).replaceAll(path.sep, "/"),
  };
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
    const documents = rows.map((r) => ({
      ...r,
      filename: maybeDecodeLatin1Filename(r.filename),
    }));
    res.json({ documents });
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
    let insertedIds = [];
    let savedFilePath = "";
    try {
      if (!req.file) return res.status(400).json({ error: "请选择要上传的文件" });
      const normalizedFilename = maybeDecodeLatin1Filename(req.file.originalname);

      const { rows: ws } = await query(
        "SELECT id FROM workspaces WHERE slug=$1", [req.params.slug]
      );
      if (!ws.length) return res.status(404).json({ error: "知识库不存在" });
      const workspaceId = ws[0].id;

      // 计算文件 hash，相同文件不重复入库
      const fileHash = crypto.createHash("md5").update(req.file.buffer).digest("hex");
      const { rows: existing } = await query(
        `SELECT d.id,
                EXISTS (SELECT 1 FROM vectors v WHERE v.doc_id = d.id) AS has_vector
         FROM documents d
         WHERE d.workspace_id=$1 AND d.file_hash=$2
         LIMIT 1`,
        [workspaceId, fileHash]
      );
      if (existing.length) {
        if (!existing[0].has_vector) {
          const { rows: staleDocs } = await query(
            "SELECT id FROM documents WHERE workspace_id=$1 AND file_hash=$2",
            [workspaceId, fileHash]
          );
          const staleIds = staleDocs.map((d) => d.id);
          await deleteByDocIds(staleIds);
          await query("DELETE FROM documents WHERE workspace_id=$1 AND file_hash=$2", [workspaceId, fileHash]);
        } else {
          return res.json({ ok: true, message: "该文件已存在，跳过重复上传", skipped: true });
        }
      }

      logger.info(`处理文件: ${normalizedFilename} (${(req.file.size / 1024).toFixed(1)} KB)`);
      const saved = await saveUploadedFile({
        workspaceId,
        fileHash,
        originalName: normalizedFilename,
        buffer: req.file.buffer,
      });
      savedFilePath = saved.absolutePath;

      // 1. 解析文本
      const text = await parseFile(req.file);
      if (!text.trim()) return res.status(400).json({ error: "文件内容为空或无法解析" });

      // 2. 分块
      const chunks = splitText(text);
      if (!chunks.length) return res.status(400).json({ error: "文本分块失败" });
      logger.info(`分块完成: ${chunks.length} 个 chunk`);

      // 3. 写入 documents 表
      insertedIds = [];
      for (let i = 0; i < chunks.length; i++) {
        const { rows } = await query(
          `INSERT INTO documents (workspace_id, filename, file_hash, chunk_index, content, metadata)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [workspaceId, normalizedFilename, fileHash, i, chunks[i],
           JSON.stringify({ chunk_index: i, total_chunks: chunks.length, storage_relpath: saved.relativePath, mime_type: req.file.mimetype || "" })]
        );
        insertedIds.push(rows[0].id);
      }

      // 4. Embedding
      logger.info(`开始 Embedding ${chunks.length} 个 chunk...`);
      const embeddings = await embedTexts(chunks);

      // 5. 写入向量表
      await addVectors({ docIds: insertedIds, workspaceId, embeddings });
      logger.info(`文件 ${normalizedFilename} 处理完成`);

      res.json({
        ok: true,
        filename:    normalizedFilename,
        chunk_count: chunks.length,
      });
    } catch (err) {
      if (insertedIds.length) {
        try {
          await deleteByDocIds(insertedIds);
          await query("DELETE FROM documents WHERE id = ANY($1::int[])", [insertedIds]);
        } catch {}
      }
      // multer 错误（文件类型/大小）直接返回 400
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: `文件超过大小限制 ${process.env.MAX_UPLOAD_SIZE_MB || 50} MB` });
      }
      if (savedFilePath) {
        try { await fs.unlink(savedFilePath); } catch {}
      }
      next(err);
    }
  }
);

/** GET /api/workspaces/:slug/documents/:filename/preview - 文档文本预览（按 chunk 合并） */
router.get("/:slug/documents/:filename/preview", async (req, res, next) => {
  try {
    const { rows: ws } = await query("SELECT id FROM workspaces WHERE slug=$1", [req.params.slug]);
    if (!ws.length) return res.status(404).json({ error: "知识库不存在" });

    const filename = decodeURIComponent(req.params.filename);
    const legacyLatin1 = Buffer.from(filename, "utf8").toString("latin1");
    const maxChars = Math.min(Math.max(parseInt(req.query.max_chars || "50000", 10), 1000), 200000);

    const { rows } = await query(
      `SELECT d.filename,
              STRING_AGG(d.content, E'\n\n' ORDER BY d.chunk_index) AS full_text,
              COUNT(*)::int AS chunk_count,
              MAX(d.metadata->>'storage_relpath') AS storage_relpath
       FROM documents d
       WHERE d.workspace_id=$1 AND (d.filename=$2 OR d.filename=$3)
       GROUP BY d.filename
       ORDER BY COUNT(*) DESC
       LIMIT 1`,
      [ws[0].id, filename, legacyLatin1]
    );

    if (!rows.length) return res.status(404).json({ error: "文档不存在" });

    const realFilename = maybeDecodeLatin1Filename(rows[0].filename);
    const ext = (realFilename.split(".").pop() || "").toLowerCase();
    const { rows: chunkRows } = await query(
      `SELECT chunk_index, content
       FROM documents
       WHERE workspace_id=$1 AND (filename=$2 OR filename=$3)
       ORDER BY chunk_index ASC
       LIMIT 200`,
      [ws[0].id, filename, legacyLatin1]
    );
    const preview = (rows[0].full_text || "").slice(0, maxChars);
    res.json({
      filename: realFilename,
      ext,
      chunk_count: rows[0].chunk_count,
      truncated: (rows[0].full_text || "").length > preview.length,
      preview,
      raw_url: rows[0].storage_relpath ? `/api/workspaces/${encodeURIComponent(req.params.slug)}/documents/${encodeURIComponent(realFilename)}/raw` : "",
      chunks: chunkRows.map((r) => ({ index: r.chunk_index, content: r.content })),
    });
  } catch (err) { next(err); }
});

router.get("/:slug/documents/:filename/raw", async (req, res, next) => {
  try {
    const { rows: ws } = await query("SELECT id FROM workspaces WHERE slug=$1", [req.params.slug]);
    if (!ws.length) return res.status(404).json({ error: "知识库不存在" });

    const filename = decodeURIComponent(req.params.filename);
    const legacyLatin1 = Buffer.from(filename, "utf8").toString("latin1");
    const { rows } = await query(
      `SELECT MAX(metadata->>'storage_relpath') AS storage_relpath,
              MAX(filename) AS filename
       FROM documents
       WHERE workspace_id=$1 AND (filename=$2 OR filename=$3)`,
      [ws[0].id, filename, legacyLatin1]
    );
    if (!rows.length || !rows[0].storage_relpath) {
      return res.status(404).json({ error: "文档原始文件不存在，请重新上传后再预览" });
    }
    const filePath = path.join(__dirname, "..", rows[0].storage_relpath);
    const fileExt = (path.extname(rows[0].filename || "") || "").toLowerCase();
    const mimeMap = {
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".txt": "text/plain; charset=utf-8",
      ".md": "text/markdown; charset=utf-8",
      ".csv": "text/csv; charset=utf-8",
      ".xls": "application/vnd.ms-excel",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
    res.setHeader("Content-Type", mimeMap[fileExt] || "application/octet-stream");
    res.sendFile(filePath);
  } catch (err) { next(err); }
});

/** DELETE /api/workspaces/:slug/documents/:filename - 删除文档及其向量 */
router.delete("/:slug/documents/:filename", async (req, res, next) => {
  try {
    const { rows: ws } = await query("SELECT id FROM workspaces WHERE slug=$1", [req.params.slug]);
    if (!ws.length) return res.status(404).json({ error: "知识库不存在" });

    const filename = decodeURIComponent(req.params.filename);
    const legacyLatin1 = Buffer.from(filename, "utf8").toString("latin1");
    const { rows: docs } = await query(
      "SELECT id FROM documents WHERE workspace_id=$1 AND (filename=$2 OR filename=$3)",
      [ws[0].id, filename, legacyLatin1]
    );
    if (!docs.length) return res.status(404).json({ error: "文档不存在" });

    const docIds = docs.map((d) => d.id);
    await deleteByDocIds(docIds);
    await query(
      "DELETE FROM documents WHERE workspace_id=$1 AND (filename=$2 OR filename=$3)",
      [ws[0].id, filename, legacyLatin1]
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
