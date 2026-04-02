require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const logger = require("./utils/logger");

const app = express();
const PORT = process.env.SERVER_PORT || 3001;
const IS_PROD = process.env.NODE_ENV === "production";

// ─── 中间件 ────────────────────────────────────────────────────────────────
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── API 路由 ─────────────────────────────────────────────────────────────
app.use("/api/auth",       require("./routes/auth"));
app.use("/api/workspaces", require("./routes/workspaces"));
app.use("/api/settings",   require("./routes/settings"));
// documents 和 chat 路由嵌套在 workspaces 下，由 workspaces 路由内部挂载

// ─── 健康检查 ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "0.1.0", timestamp: new Date().toISOString() });
});

// ─── 生产模式：托管前端静态资源 ────────────────────────────────────────────
if (IS_PROD) {
  const publicPath = path.join(__dirname, "public");
  app.use(express.static(publicPath));
  // 所有非 API 路由返回前端 index.html（SPA 路由支持）
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile(path.join(publicPath, "index.html"));
    }
  });
}

// ─── 统一错误处理 ─────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Multer 错误（文件类型/大小） → 400
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: `文件超过大小限制 ${process.env.MAX_UPLOAD_SIZE_MB || 50} MB` });
  }
  if (err.message?.includes("不支持的文件类型")) {
    return res.status(400).json({ error: err.message });
  }

  logger.error(`[${req.method}] ${req.path} → ${err.message}`);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

// ─── 启动 ─────────────────────────────────────────────────────────────────
async function main() {
  const { testConnection, query } = require("./db/client");
  const ok = await testConnection();
  if (!ok) {
    logger.error("无法连接到 PostgreSQL，请检查 DATABASE_URL 配置。");
    process.exit(1);
  }

  // 启动时将数据库配置同步到进程环境变量（覆盖 .env）
  try {
    const { rows } = await query("SELECT key, value FROM system_settings WHERE value != ''");
    rows.forEach((r) => {
      if (r.value) process.env[r.key.toUpperCase()] = r.value;
    });
    if (rows.length) logger.info(`已从数据库加载 ${rows.length} 条配置`);
  } catch { /* system_settings 可能尚未初始化，跳过 */ }

  app.listen(PORT, () => {
    logger.info(`✅ LiteRAG server running on http://localhost:${PORT}`);
    if (IS_PROD) {
      logger.info(`   前端已托管，访问 http://localhost:${PORT} 即可使用。`);
    } else {
      logger.info(`   开发模式：前端请单独运行 yarn dev:frontend`);
    }
  });
}

main();
