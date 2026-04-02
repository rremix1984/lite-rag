-- ============================================================
-- LiteRAG 向量存储表
-- 依赖 pgvector 扩展（需要 PostgreSQL + pgvector 已安装）
-- 执行前确保已运行：CREATE EXTENSION IF NOT EXISTS vector;
-- ============================================================

-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 向量表
-- 与 documents 表一一对应（每个 chunk 对应一条向量记录）
-- embedding 列的维度在建表时由 EMBEDDING_DIMENSIONS 决定
-- 注意：维度一旦确定不可更改，如需变更需重建索引并重新向量化所有文档
CREATE TABLE IF NOT EXISTS vectors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id       INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workspace_id INT NOT NULL,
  -- 向量维度在迁移执行时动态替换，默认 1536（对应 text-embedding-ada-002 等）
  -- 如使用 768 维模型（如 bge-base）请修改此值再执行迁移
  embedding    vector(1536),
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 使用 IVFFlat 索引加速余弦相似度查询
-- lists 参数建议取 sqrt(行数)，初始设 100 即可，数据量大后可重建
CREATE INDEX IF NOT EXISTS idx_vectors_workspace
  ON vectors(workspace_id);

CREATE INDEX IF NOT EXISTS idx_vectors_embedding
  ON vectors USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
