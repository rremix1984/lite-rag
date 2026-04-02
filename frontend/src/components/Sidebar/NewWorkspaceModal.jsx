import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "@phosphor-icons/react";
import { create } from "@/api/workspaces";
import { toast } from "react-toastify";

export default function NewWorkspaceModal({ onClose, onCreated }) {
  const navigate = useNavigate();
  const [name, setName]       = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { workspace } = await create({ name: name.trim() });
      toast.success(`知识库「${workspace.name}」创建成功`);
      onCreated(workspace);
      navigate(`/workspace/${workspace.slug}`);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    // 遮罩层
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-theme-bg-secondary border border-white/10 rounded-2xl w-full max-w-md mx-4 p-6 animate-fadeUpIn">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-lg">新建知识库</h2>
          <button
            onClick={onClose}
            className="text-theme-text-secondary hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-theme-text-secondary">知识库名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：产品文档、研发知识库..."
              autoFocus
              maxLength={50}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5
                         text-white placeholder-theme-placeholder text-sm
                         focus:outline-none focus:border-theme-button-primary/60 transition-colors"
            />
          </div>

          <div className="flex justify-end gap-3 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-theme-text-secondary hover:text-white
                         border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-all
                         bg-theme-button-primary text-[#0e0f0f]
                         hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "创建中..." : "创建"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
