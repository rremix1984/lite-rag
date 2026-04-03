import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import PromptInput from "@/components/ChatContainer/PromptInput";
import DocumentManager from "@/components/DocumentManager";
import { getAll } from "@/api/workspaces";

export default function KimiHome() {
  const [showDocs, setShowDocs] = useState(false);
  const [firstSlug, setFirstSlug] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    getAll().then(({ workspaces }) => {
      setFirstSlug(workspaces?.[0]?.slug || "");
    }).catch(() => {});
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0b0d10]">
      <Sidebar />
      <main className="flex-1 relative overflow-hidden">
        <div className="h-full overflow-y-auto pb-16">
          <div className="max-w-5xl mx-auto pt-16 pb-10 px-8 text-center">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-[0.25em] text-white mb-8">LiteRAG</h1>
            <div className="flex items-center justify-center gap-2 mb-4">
              <button
                onClick={() => {
                  if (firstSlug) navigate(`/workspace/${firstSlug}`);
                }}
                className="text-xs rounded-full px-3 py-1 border border-white/15 text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                历史会话
              </button>
              <button
                onClick={() => setShowDocs((v) => !v)}
                className="text-xs rounded-full px-3 py-1 border border-white/15 text-white hover:bg-white/10 transition-colors"
              >
                文档
              </button>
              <button
                disabled
                className="text-xs rounded-full px-3 py-1 border border-white/10 text-white/40 cursor-not-allowed"
              >
                网站（未开通）
              </button>
            </div>

            <div className="mt-6">
              <PromptInput
                mode="landing"
                onSend={(text) => {
                  if (firstSlug) {
                    navigate(`/workspace/${firstSlug}`);
                  } else {
                    setShowDocs(true);
                  }
                }}
                onStop={() => {}}
                onClear={() => {}}
                streaming={false}
              />
            </div>
          </div>
        </div>

        {showDocs && firstSlug && (
          <div className="absolute top-0 right-0 h-full">
            <DocumentManager slug={firstSlug} onClose={() => setShowDocs(false)} />
          </div>
        )}
      </main>
    </div>
  );
}
