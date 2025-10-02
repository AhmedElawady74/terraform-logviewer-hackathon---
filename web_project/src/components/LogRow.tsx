import { useState } from "react";
import dayjs from "dayjs";
import type { LogItem } from "../type";
import { getLogBody } from "../lib/api"; // fetch a small snippet of req/res body on demand

const txt = await getLogBody(log.id, "req"); // returns string

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

// Prefer to show a short human-friendly text instead of raw JSON blob
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

export default function LogRow({ log, onMarked }: Props) {
  // Local UI state — do NOT mutate props
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reqPeek, setReqPeek] = useState<string | null>(null);
  const [resPeek, setResPeek] = useState<string | null>(null);

  const ts = log.ts ? dayjs(log.ts).format("YYYY-MM-DD HH:mm:ss") : "";

  async function loadBodiesOnce() {
    if (loading) return;
    setLoading(true);
    try {
      if (log.has_req_body && reqPeek == null) {
        const txt = await getLogBody(log.id, "req");
        setReqPeek(txt.slice(0, 200));
      }
      if (log.has_res_body && resPeek == null) {
        const txt = await getLogBody(log.id, "res");
        setResPeek(txt.slice(0, 200));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="row">
        <div className="ts">{ts}</div>
        <div>{levelBadge(log.level)}</div>
        <div className="msg">
          {extractSummary(log.summary)}
          {(log.has_req_body || log.has_res_body) && (
            <>
              &nbsp;
              <button
                className="linklike"
                onClick={() => {
                  const next = !expanded;
                  setExpanded(next);
                  if (next) loadBodiesOnce();
                }}
              >
                {expanded ? "Hide body" : "Expand body"}
              </button>
            </>
          )}
        </div>
        <div className="actions">
          <button
            className="button"
            onClick={() => onMarked(log.id, !log.is_read)}
            title={log.is_read ? "Unmark" : "Mark as read"}
          >
            {log.is_read ? "Unmark" : "Mark as read"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="json">
          <div>
            <b>req</b>{" "}
            {log.has_req_body ? (reqPeek ?? (loading ? "Loading…" : "…")) : <i>—</i>}
          </div>
          <div>
            <b>res</b>{" "}
            {log.has_res_body ? (resPeek ?? (loading ? "Loading…" : "…")) : <i>—</i>}
          </div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>
            <small>
              ID: {log.id} · section: {log.section || "—"} · tf_req_id:{" "}
              {log.tf_req_id || "—"}
            </small>
          </div>
        </div>
      )}
    </div>
  );
}