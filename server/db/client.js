const { Pool } = require("pg");
const logger = require("../utils/logger");

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // 连接池配置
      max: 10,              // 最大连接数
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on("error", (err) => {
      logger.error(`PostgreSQL 连接池错误: ${err.message}`);
    });
  }
  return pool;
}

/**
 * 执行 SQL 查询
 * @param {string} text - SQL 语句
 * @param {Array} params - 参数
 */
async function query(text, params) {
  const start = Date.now();
  const res = await getPool().query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== "production") {
    logger.debug(`query [${duration}ms]: ${text.substring(0, 80).replace(/\n/g, " ")}`);
  }
  return res;
}

/**
 * 从连接池获取一个独立连接（用于事务）
 */
async function getClient() {
  return getPool().connect();
}

/**
 * 测试数据库连接
 */
async function testConnection() {
  try {
    await query("SELECT 1");
    logger.info("✅ PostgreSQL 连接成功");
    return true;
  } catch (err) {
    logger.error(`❌ PostgreSQL 连接失败: ${err.message}`);
    return false;
  }
}

module.exports = { query, getClient, testConnection };
