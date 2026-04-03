/**
 * 数据库配置导入脚本
 * 从生成的 settings_seed.sql 中读取 SQL 语句并执行导入
 * 用法: node scripts/seed-settings.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const { query } = require("../db/client");

async function seedSettings() {
  try {
    const seedFile = path.join(__dirname, "../db/settings_seed.sql");
    if (!fs.existsSync(seedFile)) {
      console.log("⚠️ 找不到配置文件: ", seedFile);
      process.exit(0);
    }

    const sql = fs.readFileSync(seedFile, "utf8");
    if (!sql.trim()) {
      console.log("⚠️ 配置脚本为空");
      process.exit(0);
    }

    console.log("📦 开始导入系统配置...");
    await query(sql);
    console.log("✅ 成功导入配置数据到数据库!");
    process.exit(0);
  } catch (err) {
    console.error("❌ 导入配置失败:", err);
    process.exit(1);
  }
}

seedSettings();