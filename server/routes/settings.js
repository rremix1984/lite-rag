const router = require("express").Router();
const { exec } = require("child_process");
const path = require("path");
const { query } = require("../db/client");
const { requireAuth } = require("../middleware/auth");

// 可管理的配置项白名单和说明
const SETTINGS_SCHEMA = {
  llm_provider: {
    label: "LLM 提供商",
    type: "select",
    default: "ollama",
    options: [
      { label: "Ollama", value: "ollama" },
      { label: "GLM", value: "glm" },
    ],
  },
  llm_base_url: { label: "LLM 接口地址", type: "url" },
  llm_api_key: { label: "LLM API Key", type: "password" },
  llm_model: { label: "LLM 模型名称", type: "text" },
  llm_context_window: { label: "LLM 上下文窗口（token）", type: "number" },
  embedding_base_url: { label: "Embedding 接口地址", type: "url" },
  embedding_api_key: { label: "Embedding API Key", type: "password" },
  embedding_model: { label: "Embedding 模型名称", type: "text" },
  embedding_dimensions: { label: "Embedding 向量维度", type: "number" },
};

/** GET /api/settings - 获取所有配置 */
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query("SELECT key, value FROM system_settings");
    const settings = {};
    rows.forEach((r) => { settings[r.key] = r.value || ""; });
    Object.entries(SETTINGS_SCHEMA).forEach(([key, def]) => {
      if (settings[key] === undefined && def.default !== undefined) {
        settings[key] = String(def.default);
      }
    });
    res.json({ settings, schema: SETTINGS_SCHEMA });
  } catch (err) { next(err); }
});

/** PUT /api/settings - 更新配置（仅允许 admin） */
router.put("/", requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "只有管理员可以修改系统配置" });
    }

    const updates = req.body;
    const allowed = Object.keys(SETTINGS_SCHEMA);

    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.includes(key)) continue;
      await query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
        [key, String(value || "")]
      );
    }

    // 同步到进程环境变量，下次请求即生效
    const { rows } = await query("SELECT key, value FROM system_settings");
    rows.forEach((r) => {
      const envKey = r.key.toUpperCase();
      if (r.value) process.env[envKey] = r.value;
    });

    // 自动执行配置导出，更新 seed SQL 文件
    exec("node scripts/dump-settings.js", { cwd: path.join(__dirname, "..") }, (err) => {
      if (err) console.error("自动导出配置失败:", err.message);
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
