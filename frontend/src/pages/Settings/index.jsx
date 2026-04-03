import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FloppyDisk, Eye, EyeSlash } from "@phosphor-icons/react";
import { getSettings, updateSettings } from "@/api/settings";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "react-toastify";

const GROUPS = [
  {
    title: "LLM 语言模型",
    desc:  "对接内部 LLM 服务（OpenAI 兼容接口）",
    keys:  ["llm_provider", "llm_base_url", "llm_api_key", "llm_model", "llm_context_window"],
  },
  {
    title: "Embedding 向量模型",
    desc:  "对接内部 Embedding 服务（OpenAI 兼容接口）",
    keys:  ["embedding_base_url", "embedding_api_key", "embedding_model", "embedding_dimensions"],
  },
];

const PROVIDER_PRESETS = {
  ollama: {
    llm_base_url: "http://127.0.0.1:11434/v1",
    llm_api_key: "none",
    llm_model: "qwen3:4b",
    embedding_base_url: "http://127.0.0.1:11434/v1",
    embedding_api_key: "none",
    embedding_model: "nomic-embed-text:latest",
  },
  glm: {
    llm_base_url: "https://open.bigmodel.cn/api/paas/v4",
    llm_api_key: "",
    llm_model: "glm-4-flash",
    embedding_base_url: "https://open.bigmodel.cn/api/paas/v4",
    embedding_api_key: "",
    embedding_model: "embedding-3",
  },
};

function SettingField({ fieldKey, label, type, value, options = [], onChange }) {
  const [show, setShow] = useState(false);
  const inputType = type === "password" ? (show ? "text" : "password")
    : type === "number" ? "number" : "text";

  if (type === "select") {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-theme-text-secondary">{label}</label>
        <select
          value={value}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5
                     text-white text-sm focus:outline-none focus:border-white/30 transition-colors"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#111]">
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-theme-text-secondary">{label}</label>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          placeholder={type === "url" ? "http://..." : ""}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5
                     text-white placeholder-theme-placeholder text-sm
                     focus:outline-none focus:border-white/30 transition-colors
                     pr-10"
        />
        {type === "password" && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-text-secondary hover:text-white"
          >
            {show ? <EyeSlash size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [values, setValues]   = useState({});
  const [schema, setSchema]   = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    getSettings()
      .then(({ settings, schema: s }) => {
        setValues(settings);
        setSchema(s);
      })
      .catch(() => toast.error("加载配置失败"))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(key, val) {
    setValues((prev) => {
      if (key === "llm_provider") {
        const next = { ...prev, llm_provider: val };
        const currentProvider = prev.llm_provider || "ollama";
        const currentPreset = PROVIDER_PRESETS[currentProvider] || {};
        const targetPreset = PROVIDER_PRESETS[val] || {};
        const syncFields = [
          "llm_base_url",
          "llm_api_key",
          "llm_model",
          "embedding_base_url",
          "embedding_api_key",
          "embedding_model",
        ];
        syncFields.forEach((field) => {
          const oldValue = prev[field] || "";
          if (!oldValue || oldValue === currentPreset[field]) {
            next[field] = targetPreset[field] || "";
          }
        });
        return next;
      }

      const next = { ...prev, [key]: val };
      const currentProvider = prev.llm_provider || "ollama";
      const currentPreset = PROVIDER_PRESETS[currentProvider] || {};

      if (key === "llm_api_key") {
        const oldEmbeddingKey = prev.embedding_api_key || "";
        if (!oldEmbeddingKey || oldEmbeddingKey === currentPreset.embedding_api_key || oldEmbeddingKey === (prev.llm_api_key || "")) {
          next.embedding_api_key = val;
        }
      }

      if (key === "llm_base_url") {
        const oldEmbeddingBase = prev.embedding_base_url || "";
        if (!oldEmbeddingBase || oldEmbeddingBase === currentPreset.embedding_base_url || oldEmbeddingBase === (prev.llm_base_url || "")) {
          next.embedding_base_url = val;
        }
      }

      if (key === "embedding_base_url") {
        const oldLlmBase = prev.llm_base_url || "";
        if (!oldLlmBase || oldLlmBase === currentPreset.llm_base_url || oldLlmBase === (prev.embedding_base_url || "")) {
          next.llm_base_url = val;
        }
      }

      if (key === "embedding_api_key") {
        const oldLlmKey = prev.llm_api_key || "";
        if (!oldLlmKey || oldLlmKey === currentPreset.llm_api_key || oldLlmKey === (prev.embedding_api_key || "")) {
          next.llm_api_key = val;
        }
      }

      return next;
    });
  }

  async function handleSave() {
    const requiredKeys = ["llm_base_url", "llm_model", "embedding_base_url", "embedding_model"];
    for (const key of requiredKeys) {
      if (!String(values[key] || "").trim()) {
        toast.error(`请先填写「${schema[key]?.label || key}」`);
        return;
      }
    }

    setSaving(true);
    try {
      await updateSettings(values);
      toast.success("配置已保存，当前服务立即生效");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-theme-bg-primary">
        <div className="w-6 h-6 border-2 border-theme-button-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-theme-bg-primary overflow-hidden">
      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto show-scrollbar">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {/* 页头 */}
          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={() => navigate("/workspace")}
              className="p-2 rounded-lg text-theme-text-secondary hover:text-white hover:bg-white/10 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-white font-semibold text-xl">系统配置</h1>
              <p className="text-theme-text-secondary text-xs mt-0.5">
                LLM 与 Embedding 按同一提供商联动配置
              </p>
            </div>
          </div>

          {/* 配置分组 */}
          <div className="space-y-8">
            {GROUPS.map((group) => (
              <div key={group.title} className="bg-theme-bg-secondary border border-white/10 rounded-2xl p-6">
                <div className="mb-5">
                  <h2 className="text-white font-medium">{group.title}</h2>
                  <p className="text-theme-text-secondary text-xs mt-0.5">{group.desc}</p>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {group.keys.map((key) => (
                    schema[key] && (
                      <SettingField
                        key={key}
                        fieldKey={key}
                        label={schema[key].label}
                        type={schema[key].type}
                        options={schema[key].options || []}
                        value={values[key] || ""}
                        onChange={handleChange}
                      />
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 保存按钮 */}
          {user?.role === "admin" && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm
                           bg-theme-button-primary text-[#0e0f0f]
                           hover:opacity-90 active:scale-[0.98] transition-all
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FloppyDisk size={16} weight="bold" />
                {saving ? "保存中..." : "保存配置"}
              </button>
            </div>
          )}

          {user?.role !== "admin" && (
            <p className="text-center text-theme-text-secondary text-xs mt-6">
              只有管理员可以修改配置
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
