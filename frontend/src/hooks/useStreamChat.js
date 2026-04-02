import { useEffect, useRef, useState } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useAuth } from "@/contexts/AuthContext";
import { getChats, clearChats } from "@/api/chat";

const uid = () => crypto.randomUUID();

const TOKEN_KEY = "lite-rag-token";

export function useStreamChat(slug) {
  const { token } = useAuth();
  const [messages, setMessages]   = useState([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef(null);

  // 切换知识库时加载历史
  useEffect(() => {
    if (!slug) { setMessages([]); return; }
    getChats(slug)
      .then(({ chats }) => {
        setMessages(
          chats.map((c) => ({
            id:      c.id,
            role:    c.role,
            content: c.content,
            sources: c.sources || [],
          }))
        );
      })
      .catch(() => setMessages([]));
  }, [slug]);

  async function sendMessage(text) {
    if (!text.trim() || streaming || !slug) return;

    const userMsg      = { id: uid(), role: "user",      content: text.trim(), sources: [] };
    const assistantMsg = { id: uid(), role: "assistant", content: "",          sources: [], streaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    // 中止之前的连接（防止重复）
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      await fetchEventSource(`/api/workspaces/${slug}/chat`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          Authorization:   `Bearer ${localStorage.getItem(TOKEN_KEY)}`,
        },
        body:    JSON.stringify({ message: text.trim() }),
        signal:  abortRef.current.signal,

        onmessage(ev) {
          try {
            const data = JSON.parse(ev.data);

            if (data.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: `❌ ${data.error}`, streaming: false }
                    : m
                )
              );
              setStreaming(false);
              return;
            }

            if (data.textResponse) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: m.content + data.textResponse }
                    : m
                )
              );
            }

            if (data.close) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, sources: data.sources || [], streaming: false }
                    : m
                )
              );
              setStreaming(false);
            }
          } catch { /* ignore parse errors */ }
        },

        onerror(err) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: "❌ 连接失败，请重试", streaming: false }
                : m
            )
          );
          setStreaming(false);
          throw err; // 停止重连
        },
      });
    } catch {
      setStreaming(false);
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
    setStreaming(false);
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
    );
  }

  async function handleClearChats() {
    await clearChats(slug);
    setMessages([]);
  }

  return { messages, streaming, sendMessage, stopStreaming, clearChats: handleClearChats };
}
