const TOKEN_KEY = "lite-rag-token";

/**
 * 携带 JWT token 的 fetch 封装
 * 自动添加 Authorization 和 Content-Type 头
 *
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<any>} 解析后的 JSON 数据
 */
export async function authFetch(url, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  // 401 → 清除 token，触发页面刷新重新登录
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/login";
    throw new Error("登录已过期，请重新登录");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
  return data;
}

/**
 * 上传文件专用（不设置 Content-Type，让浏览器自动处理 multipart）
 */
export async function authUpload(url, formData) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/login";
    throw new Error("登录已过期，请重新登录");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `上传失败 (${res.status})`);
  return data;
}
