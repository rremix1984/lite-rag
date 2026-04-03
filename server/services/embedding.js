const OpenAI = require("openai").default;
const logger  = require("../utils/logger");

let _client = null;

function getBaseURL() {
  return process.env.EMBEDDING_BASE_URL || process.env.LLM_BASE_URL || "";
}

function getClient() {
  if (!_client) {
    _client = new OpenAI({
      baseURL: getBaseURL() || undefined,
      apiKey:  process.env.EMBEDDING_API_KEY  || process.env.LLM_API_KEY || "none",
    });
  }
  return _client;
}

function normalizeEmbedding(embedding, dimensions) {
  if (!Array.isArray(embedding)) return [];
  const vec = embedding.map((x) => Number(x) || 0);
  if (!Number.isFinite(dimensions) || dimensions <= 0) return vec;
  if (vec.length === dimensions) return vec;
  if (vec.length > dimensions) return vec.slice(0, dimensions);
  return vec.concat(new Array(dimensions - vec.length).fill(0));
}

/**
 * 批量嵌入文本，返回向量数组
 * 自动分批（每批最多 100 条）避免超时
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
async function embedTexts(texts) {
  const BATCH_SIZE = 100;
  const model = process.env.EMBEDDING_MODEL || "text-embedding-ada-002";
  const dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || "0", 10);
  const provider = (process.env.LLM_PROVIDER || "").toLowerCase();
  const baseURL = getBaseURL();
  const client = getClient();
  const allEmbeddings = [];

  if (!baseURL) {
    throw new Error("Embedding 服务未配置，请在系统配置中填写 Embedding 接口地址");
  }

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    logger.debug(`Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)} (${batch.length} texts)`);
    let res;
    try {
      const payload = { model, input: batch };
      if (provider === "glm" && Number.isFinite(dimensions) && dimensions > 0) {
        payload.dimensions = dimensions;
      }
      res = await client.embeddings.create(payload);
    } catch (err) {
      const msg = err?.message || "unknown";
      if (msg.toLowerCase().includes("connection error")) {
        throw new Error(`Embedding 服务连接失败，请检查接口地址与服务状态：${baseURL}`);
      }
      throw new Error(`Embedding 调用失败：${msg}`);
    }
    allEmbeddings.push(...res.data.map((d) => normalizeEmbedding(d.embedding, dimensions)));
  }

  return allEmbeddings;
}

module.exports = { embedTexts };
