import { authFetch, authUpload } from "@/utils/api";

const base = (slug) => `/api/workspaces/${slug}/documents`;

export const getDocuments  = (slug)           => authFetch(base(slug));
export const deleteDocument = (slug, filename) =>
  authFetch(`${base(slug)}/${encodeURIComponent(filename)}`, { method: "DELETE" });

/**
 * 上传文件（multipart/form-data）
 * @param {string} slug
 * @param {File} file
 * @returns {Promise<{ ok, filename, chunk_count, skipped? }>}
 */
export async function uploadDocument(slug, file) {
  const form = new FormData();
  form.append("file", file);
  return authUpload(base(slug), form);
}
