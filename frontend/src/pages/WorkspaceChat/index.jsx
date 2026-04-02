import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Books, ArrowRight, FolderOpen } from "@phosphor-icons/react";
import Sidebar from "@/components/Sidebar";
import DocumentManager from "@/components/DocumentManager";
import { getBySlug } from "@/api/workspaces";

export default function WorkspaceChat() {
  const { slug } = useParams();
  const [workspace, setWorkspace]   = useState(null);
  const [loading, setLoading]       = useState(false);
  const [showDocs, setShowDocs]     = useState(false);

  useEffect(() => {
    if (!slug) { setWorkspace(null); return; }
    setLoading(true);
    getBySlug(slug)
      .then(({ workspace: ws }) => setWorkspace(ws))
      .catch(() => setWorkspace(null))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-theme-bg-primary">
      {/* 侧边栏 */}
      <Sidebar />

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col bg-theme-bg-chat overflow-hidden">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-theme-button-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !slug || !workspace ? (
          /* 空状态：未选中知识库 */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10
                            flex items-center justify-center">
              <Books size={32} className="text-white/30" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg mb-1">尚未选择知识库</h2>
              <p className="text-theme-text-secondary text-sm">
                从左侧块择一个知识库，或新建一个开始对话
              </p>
            </div>
            <div className="flex items-center gap-2 text-theme-text-secondary text-xs mt-2">
              <ArrowRight size={14} className="rotate-180" />
              点击左侧「新建知识库」开始
            </div>
          </div>
        ) : (
          /* Phase 4/5 实现：文档管理 + 对话区 */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 知识库标题栏 */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
              <div>
                <h1 className="text-white font-semibold text-base">{workspace.name}</h1>
                {workspace.description && (
                  <p className="text-theme-text-secondary text-xs mt-0.5">{workspace.description}</p>
                )}
              </div>
              {/* 文档管理 Toggle */}
              <button
                onClick={() => setShowDocs((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                            transition-colors border
                            ${showDocs
                              ? "bg-theme-button-primary/15 text-theme-button-primary border-theme-button-primary/30"
                              : "text-theme-text-secondary border-white/10 hover:text-white hover:bg-white/5"
                            }`}
              >
                <FolderOpen size={14} />
                文档
              </button>
            </header>

            {/* 内容区：对话 + 可选文档面板 */}
            <div className="flex-1 flex overflow-hidden">
              {/* 对话内容区（Phase 5 展开） */}
              <div className="flex-1 flex items-center justify-center">
                <p className="text-theme-text-secondary text-sm">
                  对话区域 — Phase 5 实现
                </p>
              </div>

              {/* 文档管理面板（右侧抽屉） */}
              {showDocs && (
                <DocumentManager
                  slug={slug}
                  onClose={() => setShowDocs(false)}
                />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
