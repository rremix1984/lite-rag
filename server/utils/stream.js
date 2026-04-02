/**
 * SSE 响应写入工具
 * 裁剪自 AnythingLLM server/utils/helpers/chat/responses.js
 *
 * Chunk 数据结构:
 * {
 *   uuid:         string,   - 本次对话唯一 ID
 *   type:         string,   - "textResponseChunk" | "abort"
 *   textResponse: string,   - 当前 token 文本（abort 时为 null）
 *   sources:      Array,    - 引用来源（仅 close=true 时携带）
 *   close:        boolean,  - true 表示流结束
 *   error:        string|false - 错误信息
 * }
 */

/**
 * 安全序列化（处理 BigInt 等不可序列化类型）
 */
function safeStringify(obj) {
  return JSON.stringify(obj, (_, value) => {
    if (typeof value === "bigint") return value.toString();
    return value;
  });
}

/**
 * 向 SSE 响应写入一个数据块
 * @param {import("express").Response} res
 * @param {Object} data
 */
function writeChunk(res, data) {
  res.write(`data: ${safeStringify(data)}\n\n`);
}

/**
 * 设置 SSE 响应头
 * @param {import("express").Response} res
 */
function initSSE(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // 关闭 Nginx 缓冲
  res.flushHeaders();
}

/**
 * 处理 OpenAI 兼容的流式响应，逐 token 推送到前端
 * @param {import("express").Response} res
 * @param {AsyncIterable} stream  - openai SDK 返回的流
 * @param {Object} opts
 * @param {string} opts.uuid      - 本次消息 ID
 * @param {Array}  opts.sources   - 流结束后附带的引用来源
 * @returns {Promise<string>}     - 完整回复文本
 */
async function pipeStreamToSSE(res, stream, { uuid, sources = [] }) {
  let fullText = "";

  // 客户端断开时提前终止
  const handleAbort = () => {
    fullText = fullText || "";
  };
  res.on("close", handleAbort);

  try {
    for await (const chunk of stream) {
      const message = chunk?.choices?.[0];
      const token = message?.delta?.content;

      if (token) {
        fullText += token;
        writeChunk(res, {
          uuid,
          type: "textResponseChunk",
          textResponse: token,
          sources: [],
          close: false,
          error: false,
        });
      }

      // finish_reason 出现时表示流结束
      if (
        message?.hasOwnProperty("finish_reason") &&
        message.finish_reason !== "" &&
        message.finish_reason !== null
      ) {
        writeChunk(res, {
          uuid,
          type: "textResponseChunk",
          textResponse: "",
          sources,
          close: true,
          error: false,
        });
        res.removeListener("close", handleAbort);
        break;
      }
    }
  } catch (err) {
    writeChunk(res, {
      uuid,
      type: "abort",
      textResponse: null,
      sources: [],
      close: true,
      error: err.message,
    });
  }

  return fullText;
}

/**
 * 发送一次性非流式文本响应（用于错误/拒绝回复）
 */
function writeTextResponse(res, { uuid, text, sources = [], error = false }) {
  writeChunk(res, {
    uuid,
    type: "textResponse",
    textResponse: text,
    sources,
    close: true,
    error,
  });
}

module.exports = { initSSE, writeChunk, pipeStreamToSSE, writeTextResponse };
