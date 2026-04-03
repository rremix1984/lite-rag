INSERT INTO system_settings (key, value)
VALUES ('llm_provider', 'ollama')
ON CONFLICT (key) DO NOTHING;
