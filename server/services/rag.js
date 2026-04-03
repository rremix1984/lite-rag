const { embedTexts }       = require("./embedding");
const { similaritySearch } = require("./vectordb");
const { query }            = require("../db/client");

const DEFAULT_PROMPT = `你是一个高效、准确的 AI 助手。请根据下方提供的文档内容回答用户的问题。
如果文档中没有相关信息，请直接告知用户“根据当前知识库的文档无法回答该问题”。请勿假设内容。回答请简洁、专业。`;

/**
 * 1. 嵌入用户问题 2. 检索相关 chunk  3. 返回 context 和来源列表
 */
async function buildRAGContext({ workspaceId, userMessage, topN = 4, threshold = 0.25 }) {
  const [queryEmbedding] = await embedTexts([userMessage]);
  let sources = await similaritySearch({ workspaceId, queryEmbedding, topN, threshold });
  if (!sources.length) {
    sources = await similaritySearch({ workspaceId, queryEmbedding, topN, threshold: -1 });
  }

  // 文件名匹配兜底：用户问题包含的关键词与文件名 ILIKE
  if (!sources.length) {
    const keywords = Array.from(
      new Set(
        (userMessage || "")
          .replace(/["'()，。！？、…]/g, " ")
          .split(/\s+/)
          .map((w) => w.trim())
          .filter((w) => w.length >= 2)
      )
    );
    if (keywords.length) {
      const patterns = keywords.map((k) => `%${k}%`);
      const { rows } = await query(
        `WITH m AS (
           SELECT DISTINCT filename
           FROM documents
           WHERE workspace_id=$1 AND (${patterns.map((_,i)=>`filename ILIKE $${i+2}`).join(" OR ")})
           LIMIT $${patterns.length + 2}
         )
         SELECT d.filename, d.content, 1.0 AS score
         FROM documents d
         JOIN m ON m.filename = d.filename
         WHERE d.workspace_id=$1
         ORDER BY d.filename, d.chunk_index ASC
         LIMIT $${patterns.length + 3}`,
        [workspaceId, ...patterns, topN, topN * 2]
      );
      if (rows.length) {
        // 每个文件只取开头一个 chunk，避免上下文过长
        const seen = new Set();
        const picked = [];
        for (const r of rows) {
          if (!seen.has(r.filename)) {
            picked.push({ filename: r.filename, content: r.content, score: 1.0 });
            seen.add(r.filename);
          }
          if (picked.length >= topN) break;
        }
        sources = picked;
      }
    }
  }

  const contextText = sources.length
    ? sources.map((s, i) => `[${i + 1}] 文档：${s.filename}\n${s.content}`).join("\n\n---\n\n")
    : "";

  return { contextText, sources };
}

/**
 * 获取最近对话历史（两个角色按时间顺序）
 */
async function getRecentHistory({ workspaceId, userId, limit = 20 }) {
  const { rows } = await query(
    `SELECT role, content FROM chats
     WHERE workspace_id = $1 AND (user_id = $2 OR user_id IS NULL)
     ORDER BY created_at DESC LIMIT $3`,
    [workspaceId, userId, limit]
  );
  return rows.reverse().map((r) => ({ role: r.role, content: r.content }));
}

/**
 * 组装发送给 LLM 的 messages 数组
 */
function buildMessages({ workspace, userMessage, contextText, history }) {
  const sysPrompt = workspace.system_prompt || DEFAULT_PROMPT;
  const systemContent = contextText
    ? `${sysPrompt}\n\n---\n\n以下是与问题相关的文档内容：\n\n${contextText}`
    : sysPrompt;

  return [
    { role: "system", content: systemContent },
    ...history,
    { role: "user",   content: userMessage },
  ];
}

module.exports = { buildRAGContext, getRecentHistory, buildMessages };
