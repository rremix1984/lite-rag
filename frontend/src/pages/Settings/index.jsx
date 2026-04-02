import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FloppyDisk, Eye, EyeSlash } from "@phosphor-icons/react";
import { getSettings, updateSettings } from "@/api/settings";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "react-toastify";

const GROUPS = [
  {
    title: "LLM 语言模型",
    desc:  "对接内部 LLM 服务（OpenAI 兆容接口）",
    keys:  ["llm_base_url", "llm_api_key", "llm_model", "llm_context_window"],
  },
  {
    title: "Embedding 向量模型",
    desc:  "对接内部 Embedding 服务（OpenAI 兆容接口）",
    keys:  ["embedding_base_url", "embedding_api_key", "embedding_model", "embedding_dimensions"],
  },
];

function SettingField({ fieldKey, label, type, value, onChange }) {
  const [show, setShow] = useState(false);
  const inputType = type === "password" ? (show ? "text" : "password")
    : type === "number" ? "number" : "text";

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
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings(values);
      toast.success("配置已保存，重启服务后生效");
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
                修改 LLM 和 Embedding 服务地址
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
