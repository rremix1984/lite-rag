import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function PrivateRoute() {
  const { user, loading } = useAuth();

  // 初始验证中：显示全屏加载
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-theme-bg-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-theme-button-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-theme-text-secondary text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  // 未登录：跳转到登录页
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
