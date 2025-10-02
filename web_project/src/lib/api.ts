// web_project/src/lib/api.ts
import type { LogItem } from "../type";

// Result of importing one or more files
export type ImportResult = { imported?: number; skipped?: number } | string;

// Query type accepted by listLogs.
// NEW: wantReq, wantRes, unreadOnly have been added.
export type ListQuery = {
  q?: string;
  level?: string;
  section?: string;
  from?: string;   // yyyy-mm-dd
  to?: string;     // yyyy-mm-dd
  wantReq?: boolean;
  wantRes?: boolean;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
};

function addIfDefined(
  params: URLSearchParams,
  key: string,
  v?: string | number | boolean
) {
  if (v === undefined || v === null || v === "") return;
  if (typeof v === "boolean") {
    if (v) params.append(key, "1");
  } else {
    params.append(key, String(v));
  }
}

export async function listLogs(query: ListQuery): Promise<LogItem[]> {
  const params = new URLSearchParams();

  addIfDefined(params, "q", query.q);
  addIfDefined(params, "level", query.level);
  addIfDefined(params, "section", query.section);
  addIfDefined(params, "from", query.from);
  addIfDefined(params, "to", query.to);

  // NEW filters
  addIfDefined(params, "wantReq", query.wantReq);
  addIfDefined(params, "wantRes", query.wantRes);
  addIfDefined(params, "unreadOnly", query.unreadOnly);

  addIfDefined(params, "limit", query.limit ?? 50);
  addIfDefined(params, "offset", query.offset ?? 0);

  const res = await fetch(`/api/logs?${params.toString()}`);
  if (!res.ok) throw new Error("listLogs failed");
  return (await res.json()) as LogItem[];
}

// Fetch full body (req/res) for a single log item on demand
export async function getLogBody(
  id: number,
  part: "req" | "res"
): Promise<string> {
  const res = await fetch(`/api/logs/${id}/body?part=${encodeURIComponent(part)}`);
  if (!res.ok) throw new Error("getLogBody failed");
  return await res.text();
}

export async function importFile(file: File): Promise<ImportResult> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/import", { method: "POST", body: fd });
  if (!res.ok) return "error";
  return (await res.json()) as ImportResult;
}

export async function markRead(id: number, is_read: boolean): Promise<void> {
  await fetch(`/api/logs/${id}/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_read }),
  });
}

// Optional
export async function seedDemo(): Promise<void> {
  await fetch("/api/demo/seed", { method: "POST" });
}