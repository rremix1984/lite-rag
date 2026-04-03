const BASE = "/api/auth";

async function readJsonOrText(res) {
  const raw = await res.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { error: raw.slice(0, 200) };
  }
}

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
  const data = await readJsonOrText(res);
  if (!res.ok) throw new Error(data.error || "登录失败");
  if (!data?.token) throw new Error("登录响应异常，请检查后端服务是否已启动");
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
  const data = await readJsonOrText(res);
  if (!res.ok) throw new Error(data.error || "token 已失效");
  if (!data?.user) throw new Error("用户信息获取失败");
  return data;
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
