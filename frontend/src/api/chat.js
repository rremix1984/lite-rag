import { authFetch } from "@/utils/api";

const base = (slug) => `/api/workspaces/${slug}`;

export const getChats   = (slug) => authFetch(`${base(slug)}/chats`);
export const clearChats = (slug) => authFetch(`${base(slug)}/chats`, { method: "DELETE" });
