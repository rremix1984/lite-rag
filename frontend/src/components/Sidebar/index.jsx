import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Gear, SignOut, Trash, Books, FileText, Globe, PresentationChart, Table, CompassTool, Code } from "@phosphor-icons/react";
import { useAuth } from "@/contexts/AuthContext";
import { getAll, remove } from "@/api/workspaces";
import NewWorkspaceModal from "./NewWorkspaceModal";
import { toast } from "react-toastify";

export default function Sidebar() {
  const { slug: activeSlug } = useParams();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const [workspaces, setWorkspaces] = useState([]);
  const [showModal, setShowModal]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // slug to confirm delete
  const capabilities = [
    { key: "web", label: "网站", icon: Globe, enabled: false },
    { key: "doc", label: "文档", icon: FileText, enabled: true },
    { key: "ppt", label: "PPT", icon: PresentationChart, enabled: false },
    { key: "sheet", label: "表格", icon: Table, enabled: false },
    { key: "research", label: "深度研究", icon: CompassTool, enabled: false },
    { key: "code", label: "AI Code", icon: Code, enabled: false },
  ];

  // 加载知识库列表
  useEffect(() => {
    getAll()
      .then(({ workspaces: list }) => setWorkspaces(list))
      .catch(() => {});
  }, []);

  async function handleDelete(ws, e) {
    e.stopPropagation();
    if (deleteTarget === ws.slug) {
      // 二次确认：真正删除
      try {
        await remove(ws.slug);
        setWorkspaces((prev) => prev.filter((w) => w.slug !== ws.slug));
        toast.success(`已删除「${ws.name}」`);
        if (activeSlug === ws.slug) navigate("/workspace");
      } catch (err) {
        toast.error(err.message);
      } finally {
        setDeleteTarget(null);
      }
    } else {
      // 第一次点击：进入确认状态
      setDeleteTarget(ws.slug);
      // 3 秒后自动取消
      setTimeout(() => setDeleteTarget((t) => (t === ws.slug ? null : t)), 3000);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <>
      <aside className="flex flex-col h-full w-56 bg-[#0d0f12] border-r border-white/10 flex-shrink-0">
        <div className="px-4 py-4 border-b border-white/10">
          <h1 className="text-2xl font-bold text-white tracking-[0.08em] leading-none">LiteRAG</h1>
          {user && (
            <p className="text-xs text-theme-text-secondary mt-0.5 truncate">
              {user.username}
              {user.role === "admin" && (
                <span className="ml-1 text-[10px] text-theme-button-primary/70">管理员</span>
              )}
            </p>
          )}
        </div>

        <div className="px-3 pt-3 pb-2">
          <button
            onClick={() => setShowModal(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm
                       bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-colors"
          >
            <Plus size={16} weight="bold" />
            新建会话
          </button>
        </div>

        <div className="px-3 py-1 space-y-1">
          {capabilities.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                disabled={!item.enabled}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                           ${item.enabled
                             ? "bg-white/10 text-white border border-white/15"
                             : "text-white/40 border border-transparent hover:bg-white/5"}
                           ${!item.enabled ? "cursor-not-allowed opacity-80" : ""}`}
              >
                <Icon size={15} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mx-3 my-2 h-px bg-white/10" />

        <nav className="flex-1 overflow-y-auto px-3 py-1 show-scrollbar space-y-0.5">
          {workspaces.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
              <Books size={28} className="text-white/20" />
              <p className="text-xs text-theme-text-secondary">还没有知识库</p>
            </div>
          )}

          {workspaces.map((ws) => {
            const isActive  = ws.slug === activeSlug;
            const isDeleting = ws.slug === deleteTarget;
            return (
              <div
                key={ws.slug}
                onClick={() => { setDeleteTarget(null); navigate(`/workspace/${ws.slug}`); }}
                className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg
                            cursor-pointer transition-all select-none
                            ${isActive
                              ? "bg-white/10 text-white"
                              : "text-white/70 hover:bg-white/5 hover:text-white"
                            }`}
              >
                {/* 名称 */}
                <span className="text-sm truncate flex-1">{ws.name}</span>

                {/* 删除按钮（hover 显示） */}
                <button
                  onClick={(e) => handleDelete(ws, e)}
                  className={`flex-shrink-0 p-1 rounded transition-all
                              ${isDeleting
                                ? "text-red-400 bg-red-500/20 scale-110"
                                : "opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400"
                              }`}
                  title={isDeleting ? "再次点击确认删除" : "删除知识库"}
                >
                  <Trash size={14} />
                </button>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-3 py-3 flex items-center gap-1">
          <button
            onClick={() => navigate("/settings")}
            title="系统设置"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs
                       text-theme-text-secondary hover:text-white hover:bg-white/5 transition-colors"
          >
            <Gear size={15} />
            设置
          </button>
          <div className="w-px h-5 bg-white/10" />
          <button
            onClick={handleSignOut}
            title="退出登录"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs
                       text-theme-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <SignOut size={15} />
            退出
          </button>
        </div>
      </aside>

      {/* 新建知识库弹窗 */}
      {showModal && (
        <NewWorkspaceModal
          onClose={() => setShowModal(false)}
          onCreated={(ws) => setWorkspaces((prev) => [...prev, ws])}
        />
      )}
    </>
  );
}
