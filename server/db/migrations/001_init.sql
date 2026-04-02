-- ============================================================
-- LiteRAG 基础业务表
-- ============================================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  username   TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,                    -- bcrypt hash
  role       TEXT NOT NULL DEFAULT 'user',     -- 'admin' | 'user'
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 知识库表
CREATE TABLE IF NOT EXISTS workspaces (
  id                   SERIAL PRIMARY KEY,
  name                 TEXT NOT NULL,
  slug                 TEXT UNIQUE NOT NULL,
  description          TEXT,
  system_prompt        TEXT,                   -- 自定义 system prompt
  similarity_threshold FLOAT NOT NULL DEFAULT 0.25,
  top_n                INT NOT NULL DEFAULT 4, -- 检索返回 chunk 数量
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 文档表（每行存储一个文本 chunk，由解析器拆分后写入）
CREATE TABLE IF NOT EXISTS documents (
  id           SERIAL PRIMARY KEY,
  workspace_id INT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,                  -- 原始文件名
  file_hash    TEXT,                           -- 文件 MD5，用于去重
  chunk_index  INT NOT NULL DEFAULT 0,         -- chunk 在文档中的序号
  content      TEXT NOT NULL,                  -- chunk 文本内容
  metadata     JSONB NOT NULL DEFAULT '{}',    -- 额外元信息（页码、来源等）
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_documents_filename  ON documents(workspace_id, filename);

-- 对话历史表（每行存储一条消息，role = 'user' | 'assistant'）
CREATE TABLE IF NOT EXISTS chats (
  id           SERIAL PRIMARY KEY,
  workspace_id INT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      INT REFERENCES users(id) ON DELETE SET NULL,
  role         TEXT NOT NULL,                  -- 'user' | 'assistant'
  content      TEXT NOT NULL,
  sources      JSONB NOT NULL DEFAULT '[]',    -- 引用来源列表（仅 assistant 消息有值）
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chats_workspace ON chats(workspace_id, created_at);

-- 系统配置表（键值对，存储 LLM / Embedding 等动态配置）
CREATE TABLE IF NOT EXISTS system_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 写入默认配置（占位，实际值通过 UI 或 .env 覆盖）
INSERT INTO system_settings (key, value) VALUES
  ('llm_base_url',           ''),
  ('llm_api_key',            ''),
  ('llm_model',              ''),
  ('llm_context_window',     '4096'),
  ('embedding_base_url',     ''),
  ('embedding_api_key',      ''),
  ('embedding_model',        ''),
  ('embedding_dimensions',   '1536')
ON CONFLICT (key) DO NOTHING;
