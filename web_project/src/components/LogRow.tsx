// web_project/src/components/LogRow.tsx
import { useState } from "react";
import dayjs from "dayjs";
import type { LogItem } from "../type";
import { getLogBody } from "../lib/api";

type Props = {
  log: LogItem;
  onMarked: (id: number, is_read: boolean) => void;
};

function levelBadge(level?: string) {
  const l = (level || "").toUpperCase();
  const map: Record<string, string> = {
    ERROR: "badge badge-error",
    WARN: "badge badge-warn",
    INFO: "badge badge-info",
    DEBUG: "badge badge-debug",
    TRACE: "badge badge-trace",
  };
  return <span className={map[l] ?? "badge badge-debug"}>{l || "N/A"}</span>;
}

// Prefer short, human-friendly text instead of raw JSON blob
function extractSummary(s?: string) {
  if (!s) return "";
  const t = s.trim();
  if (t.startsWith("{") && t.endsWith("}")) {
    try {
      const obj = JSON.parse(t);
      return obj["@message"] || obj["message"] || t.slice(0, 200);
    } catch {
      /* ignore parse errors */
    }
  }
  return t.slice(0, 200);
}

// Convert unknown JSON to preview string
function toPreview(v: unknown, limit = 200): string {
  if (v == null) return "—";
  try {
    if (typeof v === "string") return v.slice(0, limit);
    return JSON.stringify(v).slice(0, limit);
  } catch {
    return String(v).slice(0, limit);
  }
}

// Simple download helper (text file)
function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function LogRow({ log, onMarked }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [loadingBody, setLoadingBody] = useState(false);
  const [reqPeek, setReqPeek] = useState<string | null>(null);
  const [resPeek, setResPeek] = useState<string | null>(null);

  const ts = log.ts ? dayjs(log.ts).format("YYYY-MM-DD HH:mm:ss") : "";

  // Fetch req/res body on demand once
  async function ensureBodyLoaded() {
    if (reqPeek !== null || resPeek !== null) return;
    setLoadingBody(true);
    try {
      const body = await getLogBody(log.id); // returns { req?: unknown; res?: unknown }
      setReqPeek(body.req !== undefined ? toPreview(body.req) : null);
      setResPeek(body.res !== undefined ? toPreview(body.res) : null);
    } finally {
      setLoadingBody(false);
    }
  }

  return (
    <div className="card">
      <div className="row">
        <div className="ts">{ts}</div>
        <div className="flex items-center gap-2">
          {levelBadge(log.level)}
          {log.is_read && <span className="badge badge-muted">READ</span>}
        </div>
        <div className="msg">
          {extractSummary(log.summary)}
          {(log.has_req_body || log.has_res_body) && (
            <>
              &nbsp;
              <button
                className="linklike"
                onClick={async () => {
                  const next = !expanded;
                  setExpanded(next);
                  if (next) await ensureBodyLoaded();
                }}
              >
                {expanded ? "Hide body" : "Expand body"}
              </button>
            </>
          )}
        </div>
        <div className="actions">
          <button className="button" onClick={() => onMarked(log.id, !log.is_read)}>
            {log.is_read ? "Unmark" : "Mark as read"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="json">
          {loadingBody ? (
            <div>Loading body…</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <b>req</b>{" "}
                  {reqPeek != null ? (
                    <kbd className="kbd">{reqPeek}</kbd>
                  ) : (
                    <i>—</i>
                  )}
                </div>
                {reqPeek != null && (
                  <button
                    className="linklike"
                    onClick={() => downloadText(reqPeek!, `log-${log.id}-req.txt`)}
                    title="Download request preview"
                  >
                    Download req
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between" style={{ marginTop: 6 }}>
                <div>
                  <b>res</b>{" "}
                  {resPeek != null ? (
                    <kbd className="kbd">{resPeek}</kbd>
                  ) : (
                    <i>—</i>
                  )}
                </div>
                {resPeek != null && (
                  <button
                    className="linklike"
                    onClick={() => downloadText(resPeek!, `log-${log.id}-res.txt`)}
                    title="Download response preview"
                  >
                    Download res
                  </button>
                )}
              </div>

              <div style={{ marginTop: 6, opacity: 0.8 }}>
                <small>
                  ID: {log.id} · section: {log.section || "—"} · tf_req_id: {log.tf_req_id || "—"}
                </small>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}