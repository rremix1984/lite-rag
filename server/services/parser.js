const path = require("path");
const logger = require("../utils/logger");

/**
 * 解析上传文件，返回纯文本内容
 * @param {{ originalname: string, buffer: Buffer }} file - multer 内存文件对象
 * @returns {Promise<string>} 提取出的文本内容
 */
async function parseFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  logger.debug(`解析文件: ${file.originalname} (${ext})`);

  switch (ext) {
    case ".pdf":  return parsePDF(file.buffer);
    case ".docx":
    case ".doc":  return parseWord(file.buffer);
    case ".xlsx":
    case ".xls":  return parseExcel(file.buffer);
    case ".txt":
    case ".md":
    case ".csv":  return file.buffer.toString("utf8");
    default:
      throw new Error(`不支持的文件类型: ${ext}`);
  }
}

async function parsePDF(buffer) {
  const pdf = require("pdf-parse");
  const data = await pdf(buffer);
  return data.text || "";
}

async function parseWord(buffer) {
  const mammoth = require("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

function parseExcel(buffer) {
  const xlsx = require("node-xlsx");
  const workbook = xlsx.parse(buffer);
  return workbook
    .map((sheet) => {
      const rows = sheet.data
        .map((row) => row.map(String).join("\t"))
        .filter((r) => r.trim());
      return `[Sheet: ${sheet.name}]\n${rows.join("\n")}`;
    })
    .join("\n\n");
}

module.exports = { parseFile };
