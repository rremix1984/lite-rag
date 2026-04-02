import { authFetch } from "@/utils/api";

const BASE = "/api/workspaces";

export const getAll    = ()           => authFetch(BASE);
export const getBySlug = (slug)       => authFetch(`${BASE}/${slug}`);
export const create    = (data)       => authFetch(BASE, { method: "POST",   body: JSON.stringify(data) });
export const update    = (slug, data) => authFetch(`${BASE}/${slug}`, { method: "PUT",    body: JSON.stringify(data) });
export const remove    = (slug)       => authFetch(`${BASE}/${slug}`, { method: "DELETE" });
