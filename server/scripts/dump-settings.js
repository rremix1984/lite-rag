/**
 * 数据库配置导出脚本
 * 读取 system_settings 表的数据，并生成可重复执行的 SQL 脚本
 * 用法: node scripts/dump-settings.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const { query } = require("../db/client");

async function dumpSettings() {
  try {
    const { rows } = await query("SELECT key, value FROM system_settings");
    if (rows.length === 0) {
      console.log("⚠️ 没有找到配置数据 (system_settings 为空)");
      process.exit(0);
    }

    let sql = "-- ============================================================\n";
    sql += "-- 自动生成的系统配置迁移/同步脚本\n";
    sql += "-- 每次更新系统配置后，可通过运行 yarn db:dump 同步生成此文件\n";
    sql += "-- 目标机器部署时可执行: psql -U <user> -d <db> -f server/db/settings_seed.sql\n";
    sql += "-- 或者通过 yarn db:seed 自动导入\n";
    sql += "-- ============================================================\n\n";

    sql += "INSERT INTO system_settings (key, value, updated_at)\nVALUES\n";

    const values = rows.map((r, index) => {
      // 处理单引号转义
      const safeValue = (r.value || "").replace(/'/g, "''");
      const isLast = index === rows.length - 1;
      return `  ('${r.key}', '${safeValue}', NOW())${isLast ? "" : ","}`;
    });

    sql += values.join("\n") + "\n";
    sql += "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();\n";

    const outputPath = path.join(__dirname, "../db/settings_seed.sql");
    fs.writeFileSync(outputPath, sql, "utf8");

    console.log(`✅ 成功导出 ${rows.length} 条配置到: ${outputPath}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ 导出配置失败:", err);
    process.exit(1);
  }
}

dumpSettings();