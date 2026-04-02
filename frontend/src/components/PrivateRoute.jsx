/**
 * 路由守卫
 * Phase 2 实现：检查 JWT token，未登录重定向到 /login
 * 当前为开发期占位，直接放行所有请求
 */
import { Outlet } from "react-router-dom";

export default function PrivateRoute() {
  // TODO: Phase 2 - 检查 localStorage token，未登录时 <Navigate to="/login" replace />
  return <Outlet />;
}
