import { createContext, useContext, useState, useEffect } from "react";
import { getMe, logout as apiLogout } from "@/api/auth";

const TOKEN_KEY = "lite-rag-token";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true); // 初始验证 token 是否有效

  // 应用启动时验证本地 token
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    getMe(token)
      .then(({ user: u }) => setUser(u))
      .catch(() => {
        // token 失效，清除
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** 登录成功后调用，持久化 token 和用户信息 */
  function saveAuth(newToken, newUser) {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  }

  /** 登出 */
  async function signOut() {
    await apiLogout();
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, saveAuth, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
