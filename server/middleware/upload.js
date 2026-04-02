const multer = require("multer");
const path = require("path");

const ALLOWED_EXT = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".txt", ".md", ".csv"];

/**
 * 文件保在内存（Buffer），无需磁盘暂存
 * 适合上传后立即解析的场景
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_UPLOAD_SIZE_MB || "50") * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXT.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型 "${ext}"，支持：${ALLOWED_EXT.join(", ")}`));
    }
  },
});

module.exports = { upload };
