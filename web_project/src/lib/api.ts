// web_project/src/lib/api.ts

export type { LogItem } from "../type";

// Result type returned by the /import endpoint.
// When FastAPI returns plain text we keep it as string.
export type ImportResult = { imported?: number; skipped?: number } | string;

const API_BASE = import.meta.env.VITE_API_BASE as string;
const API_KEY  = import.meta.env.VITE_API_KEY as string;

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE) throw new Error("VITE_API_BASE is not set");
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY ?? "",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API ${res.status}: ${txt}`);
  }
  return (await res.json()) as T;
}

// -------- Import --------

// Upload a single file
export async function importFile(file: File): Promise<ImportResult> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  const res = await fetch(`${API_BASE}/import`, {
    method: "POST",
    headers: { "X-API-Key": API_KEY ?? "" }, // no content-type for multipart
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return txt; }
}

// Optional: seed demo logs containing req/res bodies
export async function seedDemo(): Promise<{ ok: boolean; inserted: number }> {
  return apiFetch(`/import/demo`, { method: "POST" });
}

// -------- Logs --------

export async function listLogs(params: Record<string, unknown>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }
  return apiFetch<any[]>(`/logs?${usp.toString()}`);
}

export async function markRead(id: number, is_read: boolean) {
  return apiFetch(`/logs/${id}/read`, {
    method: "PATCH",
    body: JSON.stringify({ is_read }),
  });
}

// Fetch req/res body for a single log (used by LogRow on-demand expand)
export async function getLogBody(
  logId: number
): Promise<{ req?: unknown; res?: unknown }> {
  return apiFetch(`/logs/${logId}/body`);
}