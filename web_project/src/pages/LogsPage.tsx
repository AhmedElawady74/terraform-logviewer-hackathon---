import { useEffect, useMemo, useState } from "react";
import type { LogItem } from "../type";
import { importFile, listLogs, markRead, type ImportResult } from "../lib/api";
import LogRow from "../components/LogRow";

type Filters = {
  q: string;
  level: string;
  section: string;
  from: string;
  to: string;
  wantReq: boolean;   // filter: has request body
  wantRes: boolean;   // filter: has response body
  unreadOnly: boolean;
};

type PerFileImport = {
  name: string;
  status: "ok" | "error";
  imported?: number;
  skipped?: number;
};

export default function LogsPage() {
  // data
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(false);

  // filters / paging
  const [filters, setFilters] = useState<Filters>({
    q: "",
    level: "",
    section: "",
    from: "",
    to: "",
    wantReq: false,
    wantRes: false,
    unreadOnly: false,
  });
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);

  // import status (for up to 2 files)
  const [importing, setImporting] = useState(false);
  const [recentImports, setRecentImports] = useState<PerFileImport[]>([]);

  // page breakdown
  const breakdown = useMemo(() => {
    const c = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, TRACE: 0 } as Record<string, number>;
    for (const l of logs) {
      const k = (l.level || "").toUpperCase();
      if (k in c) c[k] += 1;
    }
    return c;
  }, [logs]);

  // fetch logs
  async function fetchData() {
    setLoading(true);
    try {
      const data = await listLogs({
        q: filters.q,
        level: filters.level,
        section: filters.section,
        from: filters.from,
        to: filters.to,
        wantReq: filters.wantReq,       // NEW
        wantRes: filters.wantRes,       // NEW
        unreadOnly: filters.unreadOnly, // NEW
        limit,
        offset,
      });
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters), offset, limit]);

  // mark as read/unread
  const onMarked = async (id: number, is_read: boolean) => {
    try {
      await markRead(id, is_read);
      setLogs(prev => prev.map(l => (l.id === id ? { ...l, is_read } : l)));
    } catch {
      /* keep UI as-is */
    }
  };

  // file import (max 2 files)
  const onImportFiles = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.log,application/json,text/plain";
    input.multiple = true;

    input.onchange = async () => {
      const selected = Array.from(input.files || []);
      if (selected.length === 0) return;

      // take at most 2 files
      const files = selected.slice(0, 2);
      if (selected.length > 2) {
        alert("You can import at most 2 files at once. Only the first two were taken.");
      }

      setImporting(true);
      const results: PerFileImport[] = [];

      try {
        for (const f of files) {
          try {
            const res: ImportResult = await importFile(f);
            if (typeof res === "string") {
              results.push({ name: f.name, status: "error" });
            } else {
              results.push({
                name: f.name,
                status: "ok",
                imported: res.imported ?? 0,
                skipped: res.skipped ?? 0,
              });
            }
          } catch {
            results.push({ name: f.name, status: "error" });
          }
        }

        setRecentImports(results);
        setOffset(0);
        await fetchData();
      } finally {
        setImporting(false);
      }
    };

    input.click();
  };

  // simple controls helpers
  const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setFilters(prev => ({ ...prev, [k]: v }));

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* header filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          placeholder="Search (full-text)…"
          className="px-3 py-2 rounded bg-[#151a22] border border-[#232a36] w-72"
          value={filters.q}
          onChange={(e) => setFilter("q", e.target.value)}
        />

        <select
          className="px-3 py-2 rounded bg-[#151a22] border border-[#232a36]"
          value={filters.level}
          onChange={(e) => setFilter("level", e.target.value)}
        >
          <option value="">Level</option>
          <option value="ERROR">ERROR</option>
          <option value="WARN">WARN</option>
          <option value="INFO">INFO</option>
          <option value="DEBUG">DEBUG</option>
          <option value="TRACE">TRACE</option>
        </select>

        <select
          className="px-3 py-2 rounded bg-[#151a22] border border-[#232a36]"
          value={filters.section}
          onChange={(e) => setFilter("section", e.target.value)}
        >
          <option value="">Section</option>
          <option value="plan">plan</option>
          <option value="apply">apply</option>
        </select>

        <input
          type="date"
          className="px-3 py-2 rounded bg-[#151a22] border border-[#232a36]"
          value={filters.from}
          onChange={(e) => setFilter("from", e.target.value)}
        />
        <span>—</span>
        <input
          type="date"
          className="px-3 py-2 rounded bg-[#151a22] border border-[#232a36]"
          value={filters.to}
          onChange={(e) => setFilter("to", e.target.value)}
        />

        <label className="flex items-center gap-2 ml-4">
          <input
            type="checkbox"
            checked={filters.wantReq}
            onChange={(e) => setFilter("wantReq", e.target.checked)}
          />
          <span>Req body</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filters.wantRes}
            onChange={(e) => setFilter("wantRes", e.target.checked)}
          />
          <span>Res body</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filters.unreadOnly}
            onChange={(e) => setFilter("unreadOnly", e.target.checked)}
          />
          <span>Unread only</span>
        </label>

        <div className="ml-auto flex items-center gap-2">
          <button
            className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60"
            onClick={onImportFiles}
            disabled={importing}
          >
            Import files
          </button>

          {/* per-file import result chips */}
          {recentImports.length > 0 && (
            <div className="flex items-center gap-2">
              {recentImports.slice(0, 2).map((r, i) => (
                <div
                  key={i}
                  className={`px-3 py-2 rounded-full text-sm ${
                    r.status === "ok" ? "bg-[#1e2b1e]" : "bg-[#2b1e1e]"
                  }`}
                  title={
                    r.status === "ok"
                      ? `${r.name}: imported ${r.imported ?? 0}, skipped ${r.skipped ?? 0}`
                      : `${r.name}: error`
                  }
                >
                  {i + 1}. {r.name.length > 14 ? r.name.slice(0, 14) + "…" : r.name}: {r.status}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* paging header */}
      <div className="flex items-center justify-between text-sm my-3">
        <div>
          Shown: <b>{logs.length}</b>
        </div>
        <div className="space-x-2">
          <button
            className="text-xs px-2 py-1 rounded border border-[#2b3342]"
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
          >
            Prev
          </button>
          <button
            className="text-xs px-2 py-1 rounded border border-[#2b3342]"
            onClick={() => setOffset(offset + limit)}
          >
            Next
          </button>
        </div>
      </div>

      {/* logs list */}
      {loading ? (
        <div>Loading…</div>
      ) : logs.length === 0 ? (
        <div className="text-sm text-slate-400">No logs match current filters.</div>
      ) : (
        logs.map((l) => <LogRow key={l.id} log={l} onMarked={onMarked} />)
      )}

      {/* page breakdown */}
      <div className="mt-4 text-sm flex items-center gap-2">
        <span>Page breakdown:</span>
        <span className="badge badge-error">ERR {breakdown.ERROR}</span>
        <span className="badge badge-warn">WARN {breakdown.WARN}</span>
        <span className="badge badge-info">INFO {breakdown.INFO}</span>
        <span className="badge badge-debug">DBG {breakdown.DEBUG}</span>
        <span className="badge badge-trace">TRC {breakdown.TRACE}</span>
      </div>
    </div>
  );
}