import { authFetch } from "@/utils/api";

export const getSettings    = ()       => authFetch("/api/settings");
export const updateSettings = (data)   => authFetch("/api/settings", {
  method: "PUT",
  body:   JSON.stringify(data),
});
