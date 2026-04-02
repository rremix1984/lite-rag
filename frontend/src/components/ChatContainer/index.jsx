import { useStreamChat } from "@/hooks/useStreamChat";
import ChatHistory from "./ChatHistory";
import PromptInput from "./PromptInput";
import { toast } from "react-toastify";

export default function ChatContainer({ slug }) {
  const { messages, streaming, sendMessage, stopStreaming, clearChats } = useStreamChat(slug);

  async function handleClear() {
    try {
      await clearChats();
      toast.success("对话已清空");
    } catch {
      toast.error("清空失败");
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ChatHistory messages={messages} />
      <PromptInput
        onSend={sendMessage}
        onStop={stopStreaming}
        onClear={handleClear}
        streaming={streaming}
      />
    </div>
  );
}
