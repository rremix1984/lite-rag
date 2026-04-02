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
  const sources = await similaritySearch({ workspaceId, queryEmbedding, topN, threshold });

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
