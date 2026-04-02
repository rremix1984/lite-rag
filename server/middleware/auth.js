const jwt = require("jsonwebtoken");

/**
 * 验证 JWT token，验证成功后将用户信息挂载到 req.user
 * 需要认证的路由展开这个中间件：router.get('/path', requireAuth, handler)
 */
function requireAuth(req, res, next) {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "未登录或 token 已失效" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, username: payload.username, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: "未登录或 token 已失效" });
  }
}

/**
 * 仅允许 admin 角色访问
 */
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "权限不足" });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
