const OpenAI = require("openai").default;

let _client = null;

function getClient() {
  if (!_client) {
    _client = new OpenAI({
      baseURL: process.env.LLM_BASE_URL,
      apiKey:  process.env.LLM_API_KEY || "none",
    });
  }
  return _client;
}

/**
 * 创建流式计算
 * @param {Array<{role:string, content:string}>} messages
 * @param {Object} opts
 * @returns {Promise<import('openai').Stream>}
 */
async function streamChat(messages, opts = {}) {
  return getClient().chat.completions.create({
    model:       process.env.LLM_MODEL || "gpt-3.5-turbo",
    messages,
    stream:      true,
    temperature: opts.temperature ?? 0.7,
    max_tokens:  opts.maxTokens  ?? 2048,
  });
}

module.exports = { streamChat };
