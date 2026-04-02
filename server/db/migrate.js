/**
 * 数据库迁移执行器
 * 按文件名顺序执行 migrations/ 目录下的 .sql 文件
 * 通过 schema_migrations 表记录已执行的迁移，避免重复执行
 *
 * 用法：node db/migrate.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    console.log("📦 开始执行数据库迁移...");

    // 创建迁移记录表（如果不存在）
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // 读取并排序迁移文件
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("⚠️  没有找到迁移文件。");
      return;
    }

    for (const file of files) {
      // 检查是否已执行
      const { rows } = await client.query(
        "SELECT filename FROM schema_migrations WHERE filename = $1",
        [file]
      );
      if (rows.length > 0) {
        console.log(`  ⏭️  已跳过（已执行）: ${file}`);
        continue;
      }

      // 读取并执行 SQL（替换向量维度占位符）
      let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      const dim = parseInt(process.env.EMBEDDING_DIMENSIONS || "1536", 10);
      sql = sql.replace(/vector\(1536\)/g, `vector(${dim})`);
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        console.log(`  ✅ 已执行: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`迁移文件 ${file} 执行失败: ${err.message}`);
      }
    }

    console.log("\n🎉 所有迁移执行完成！");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(`\n❌ 迁移失败: ${err.message}`);
  process.exit(1);
});
