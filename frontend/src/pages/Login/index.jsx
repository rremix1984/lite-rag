import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { useAuth } from "@/contexts/AuthContext";
import { login } from "@/api/auth";

export default function Login() {
  const { saveAuth } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setError("");
    setLoading(true);
    try {
      const { token, user } = await login(username.trim(), password);
      saveAuth(token, user);
      navigate("/workspace", { replace: true });
    } catch (err) {
      setError(err.message || "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-theme-bg-primary">
      {/* 背景装饰光晟 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm px-6">
        {/* Logo / 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Lite<span className="text-theme-button-primary">RAG</span>
          </h1>
          <p className="text-theme-text-secondary text-sm mt-2">内网知识库系统</p>
        </div>

        {/* 登录表单 */}
        <form
          onSubmit={handleSubmit}
          className="login-input-gradient rounded-2xl p-8 border border-white/10 flex flex-col gap-5"
        >
          {/* 用户名 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-theme-text-secondary">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoFocus
              autoComplete="username"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5
                         text-white placeholder-theme-placeholder text-sm
                         focus:outline-none focus:border-theme-button-primary/60
                         transition-colors"
            />
          </div>

          {/* 密码 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-theme-text-secondary">密码</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                autoComplete="current-password"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 pr-10
                           text-white placeholder-theme-placeholder text-sm
                           focus:outline-none focus:border-theme-button-primary/60
                           transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-text-secondary
                           hover:text-white transition-colors"
              >
                {showPwd ? <EyeSlash size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full py-2.5 rounded-lg font-medium text-sm transition-all
                       bg-theme-button-primary text-[#0e0f0f]
                       hover:opacity-90 active:scale-[0.98]
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                登录中...
              </span>
            ) : "登录"}
          </button>
        </form>
      </div>
    </div>
  );
}
