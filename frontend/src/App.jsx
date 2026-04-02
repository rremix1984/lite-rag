import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Login         from "@/pages/Login";
import WorkspaceChat from "@/pages/WorkspaceChat";
import Settings      from "@/pages/Settings";
import PrivateRoute  from "@/components/PrivateRoute";

export default function App() {
  return (
    <>
      <Routes>
        {/* 公开路由 */}
        <Route path="/login" element={<Login />} />

        {/* 受保护路由（Phase 2 完成后启用 PrivateRoute 守卫） */}
        <Route element={<PrivateRoute />}>
          <Route path="/"                    element={<Navigate to="/workspace" replace />} />
          <Route path="/workspace"           element={<WorkspaceChat />} />
          <Route path="/workspace/:slug"     element={<WorkspaceChat />} />
          <Route path="/settings"            element={<Settings />} />
        </Route>

        {/* 404 重定向 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </>
  );
}
