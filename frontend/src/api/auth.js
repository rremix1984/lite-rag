const BASE = "/api/auth";

/**
 * 登录
 * @param {string} username
 * @param {string} password
 * @returns {{ token: string, user: { id, username, role } }}
 */
export async function login(username, password) {
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "登录失败");
  return data;
}

/**
 * 获取当前登录用户信息（用于 token 合法性验证）
 * @param {string} token
 * @returns {{ user: { id, username, role } }}
 */
export async function getMe(token) {
  const res = await fetch(`${BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("token 已失效");
  return res.json();
}

/** 登出（无状态，仅通知服务端，可省略） */
export async function logout() {
  const token = localStorage.getItem("lite-rag-token");
  if (token) {
    await fetch(`${BASE}/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
}
