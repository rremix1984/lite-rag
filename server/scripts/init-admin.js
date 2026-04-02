/**
 * 初始化管理员账户
 * 用法：
 *   node scripts/init-admin.js                    # 交互式输入
 *   node scripts/init-admin.js admin 123456       # 命令行指定
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const readline = require("readline");

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); });
  });
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // 检查是否已有管理员
    const { rows } = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (rows.length > 0) {
      console.log("⚠️  已存在管理员账户，如需重置请手动操作数据库。");
      return;
    }

    // 获取用户名和密码
    let username = process.argv[2];
    let password = process.argv[3];

    if (!username) username = await prompt("管理员用户名（默认 admin）: ") || "admin";
    if (!password) password = await prompt("管理员密码: ");

    if (!password || password.length < 6) {
      console.error("❌ 密码长度至少 6 位");
      process.exit(1);
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, password, role) VALUES ($1, $2, 'admin') RETURNING id, username, role",
      [username, hash]
    );

    console.log(`\n✅ 管理员账户创建成功！`);
    console.log(`   用户名: ${result.rows[0].username}`);
    console.log(`   角色:   ${result.rows[0].role}`);
    console.log(`\n现在可以运行 yarn start 并使用此账户登录。`);
  } catch (err) {
    if (err.code === "23505") {
      console.error(`❌ 用户名 "${process.argv[2]}" 已存在，请换一个。`);
    } else {
      console.error(`❌ 创建失败: ${err.message}`);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
