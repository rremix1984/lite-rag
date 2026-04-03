-- ============================================================
-- 自动生成的系统配置迁移/同步脚本
-- 每次更新系统配置后，可通过运行 yarn db:dump 同步生成此文件
-- 目标机器部署时可执行: psql -U <user> -d <db> -f server/db/settings_seed.sql
-- 或者通过 yarn db:seed 自动导入
-- ============================================================

INSERT INTO system_settings (key, value, updated_at)
VALUES
  ('llm_base_url', '', NOW()),
  ('llm_api_key', '', NOW()),
  ('llm_model', '', NOW()),
  ('llm_context_window', '4096', NOW()),
  ('embedding_base_url', '', NOW()),
  ('embedding_api_key', '', NOW()),
  ('embedding_model', '', NOW()),
  ('embedding_dimensions', '1536', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
