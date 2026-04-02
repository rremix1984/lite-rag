import { useEffect, useRef } from "react";
import { renderMarkdown } from "@/utils/markdown";
import Citations from "../Citation";

function UserMessage({ message }) {
  return (
    <div className="flex justify-end w-full group">
      <div className="py-3 px-4 max-w-[75%]">
        <div className="bg-zinc-800 rounded-[20px] rounded-br-none px-4 py-3 text-white text-sm leading-relaxed break-words whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    </div>
  );
}

function AssistantMessage({ message }) {
  const html = renderMarkdown(message.content);
  return (
    <div className="flex justify-start w-full group">
      <div className="py-3 px-4 md:pl-6 w-full max-w-[85%]">
        {message.content ? (
          <div
            className={`markdown text-white text-sm leading-relaxed break-words
                        ${message.streaming ? "reply" : ""}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          /* 等待回复动画 */
          <div className="flex items-center gap-1.5 py-1">
            <span className="dot-falling" />
          </div>
        )}
        {!message.streaming && <Citations sources={message.sources} />}
      </div>
    </div>
  );
}

export default function ChatHistory({ messages }) {
  const bottomRef = useRef(null);

  // 新消息时自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages.at(-1)?.content]);

  if (!messages.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-theme-text-secondary text-sm">上传文档后开始提问</p>
      </div>
    );
  }

  return (
    <div
      id="chat-container"
      className="flex-1 overflow-y-auto py-4 no-scroll"
    >
      {messages.map((msg) =>
        msg.role === "user"
          ? <UserMessage   key={msg.id} message={msg} />
          : <AssistantMessage key={msg.id} message={msg} />
      )}
      <div ref={bottomRef} />
    </div>
  );
}
