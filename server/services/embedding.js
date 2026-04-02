const OpenAI = require("openai").default;
const logger  = require("../utils/logger");

let _client = null;

function getClient() {
  if (!_client) {
    _client = new OpenAI({
      baseURL: process.env.EMBEDDING_BASE_URL || process.env.LLM_BASE_URL,
      apiKey:  process.env.EMBEDDING_API_KEY  || process.env.LLM_API_KEY || "none",
    });
  }
  return _client;
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
  const client = getClient();
  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    logger.debug(`Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)} (${batch.length} texts)`);
    const res = await client.embeddings.create({ model, input: batch });
    allEmbeddings.push(...res.data.map((d) => d.embedding));
  }

  return allEmbeddings;
}

module.exports = { embedTexts };
