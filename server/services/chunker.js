/**
 * token-aware 滑动窗口分块，使用 cl100k_base 编码器
 *
 * 算法：
 * 1. 先按段落 (\n\n+) 分割文本
 * 2. 每个段落累积 token，超出 chunkSize 则新建 chunk
 * 3. 每个新 chunk 的开头继承上一个 chunk 的最后 overlap tokens
 */

let _enc = null;

function getEncoder() {
  if (!_enc) {
    const { get_encoding } = require("js-tiktoken");
    _enc = get_encoding("cl100k_base");
  }
  return _enc;
}

function tokenCount(text) {
  return getEncoder().encode(text).length;
}

/**
 * 拆分文本为 chunk 数组
 * @param {string} text
 * @param {{ chunkSize?: number, overlap?: number }} opts
 * @returns {string[]}
 */
function splitText(text, { chunkSize = 500, overlap = 50 } = {}) {
  if (!text || !text.trim()) return [];

  // 按段落切割，保留单行换行用于细分
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());
  const chunks = [];
  let currentTokens = [];
  let currentText = "";

  for (const para of paragraphs) {
    const paraTokens = getEncoder().encode(para);

    // 如果单个段落就超过 chunkSize，按字符切割它
    if (paraTokens.length > chunkSize) {
      // 先保存当前累积
      if (currentText.trim()) {
        chunks.push(currentText.trim());
        currentText = "";
        currentTokens = [];
      }
      // 按字符切割大段落
      const words = para.split(" ");
      let buf = "";
      let bufTokens = [];
      for (const word of words) {
        const newBuf = buf ? `${buf} ${word}` : word;
        const newTokens = getEncoder().encode(newBuf);
        if (newTokens.length > chunkSize && buf) {
          chunks.push(buf.trim());
          // overlap处理：取最后 overlap 个 token 重新开始
          const overlapText = decodeTokens(bufTokens.slice(-overlap));
          buf = overlapText ? `${overlapText} ${word}` : word;
          bufTokens = getEncoder().encode(buf);
        } else {
          buf = newBuf;
          bufTokens = newTokens;
        }
      }
      if (buf.trim()) {
        currentText = buf.trim();
        currentTokens = bufTokens;
      }
      continue;
    }

    // 当前段落加入后是否超出 chunkSize
    const newText = currentText ? `${currentText}\n\n${para}` : para;
    const newTokenCount = currentTokens.length + paraTokens.length;

    if (newTokenCount > chunkSize && currentText.trim()) {
      chunks.push(currentText.trim());
      // 补丁：新 chunk 开头继承 overlap
      const overlapText = decodeTokens(currentTokens.slice(-overlap));
      currentText = overlapText ? `${overlapText}\n\n${para}` : para;
      currentTokens = getEncoder().encode(currentText);
    } else {
      currentText = newText;
      currentTokens = getEncoder().encode(currentText);
    }
  }

  if (currentText.trim()) chunks.push(currentText.trim());
  return chunks.filter((c) => c.length > 0);
}

function decodeTokens(uint32Array) {
  try {
    const bytes = getEncoder().decode(uint32Array);
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return "";
  }
}

module.exports = { splitText, tokenCount };
