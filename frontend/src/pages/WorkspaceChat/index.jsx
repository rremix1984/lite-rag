/**
 * 主界面：侧边栏 + 对话区域
 * Phase 3/4/5 实现
 */
export default function WorkspaceChat() {
  return (
    <div className="flex h-screen w-screen bg-theme-bg-primary">
      {/* Sidebar - Phase 3 */}
      <aside className="w-64 bg-theme-bg-sidebar border-r border-white/10 flex-shrink-0 flex items-center justify-center">
        <p className="text-theme-text-secondary text-xs">侧边栏 - Phase 3 实现</p>
      </aside>
      {/* Chat - Phase 5 */}
      <main className="flex-1 flex items-center justify-center bg-theme-bg-chat">
        <p className="text-theme-text-secondary text-sm">选择或创建一个知识库开始对话</p>
      </main>
    </div>
  );
}
