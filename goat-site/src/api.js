import { lang } from "./lang.js";

// Where the backend lives. VITE_API_URL overrides. In development it is port 4100 of whatever host serves the page; in the built site
// the backend serves the pages too, so it is the same address.
export const API = (import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? "" : `${location.protocol}//${location.hostname}:4100`)).replace(/\/$/, "");

// fetch JSON from the backend; rejects on network errors, bad status or after `timeout` ms
export async function api(path, { timeout = 3500, ...init } = {}) {
  // page data, words and form errors come back in the page's language
  if (path.startsWith("/api/") && !path.includes("lang=")) path += `${path.includes("?") ? "&" : "?"}lang=${lang}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(`${API}${path}`, { ...init, signal: ctl.signal, headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers } });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error(data?.error || `HTTP ${res.status}`), { status: res.status, data });
    return data;
  } finally { clearTimeout(timer); }
}
