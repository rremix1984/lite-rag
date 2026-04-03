import { useRef, useState } from "react";
import { PaperPlaneTilt, Stop, Trash } from "@phosphor-icons/react";

export default function PromptInput({ onSend, onStop, onClear, streaming, mode = "default" }) {
  const [text, setText] = useState("");
  const textareaRef = useRef(null);
  const isLanding = mode === "landing";

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    if (!text.trim() || streaming) return;
    onSend(text);
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  return (
    <div className={`flex-shrink-0 ${isLanding ? "w-full max-w-3xl mx-auto" : "px-4 pb-4 pt-2"}`}>
      <div className={`flex items-end gap-2 bg-theme-bg-chat-input border border-theme-chat-input-border
                      focus-within:border-white/20 transition-colors
                      ${isLanding ? "rounded-3xl px-4 py-4 bg-[#15181d]" : "rounded-2xl px-4 py-3"}`}>
        {/* 文本框 */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => { setText(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
          placeholder={isLanding ? "尽管问..." : "输入消息，Enter 发送，Shift+Enter 换行..."}
          rows={1}
          disabled={streaming}
          className={`flex-1 bg-transparent text-white placeholder-theme-placeholder
                     resize-none outline-none leading-relaxed max-h-[200px] overflow-y-auto no-scroll
                     disabled:opacity-60 ${isLanding ? "text-base" : "text-sm"}`}
        />

        {/* 右侧按钮 */}
        <div className="flex items-center gap-1.5 flex-shrink-0 pb-0.5">
          {!isLanding && (
            <button
              onClick={onClear}
              disabled={streaming}
              title="清空对话"
              className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/10
                       transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Trash size={15} />
            </button>
          )}

          {/* 停止 / 发送 */}
          {streaming ? (
            <button
              onClick={onStop}
              className="p-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              <Stop size={16} weight="fill" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              className="p-2 rounded-xl bg-theme-button-primary/90 text-[#0e0f0f]
                         hover:opacity-90 active:scale-95 transition-all
                         disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <PaperPlaneTilt size={16} weight="fill" />
            </button>
          )}
        </div>
      </div>
      {!isLanding && (
        <p className="text-[11px] text-white/20 text-center mt-1.5">
          AI 可能出错，请核实重要信息
        </p>
      )}
    </div>
  );
}
