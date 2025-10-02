// web_project/src/pages/LogsPage.tsx
import { useEffect, useMemo, useState } from "react";
import type { LogItem } from "../type";
import { importFile, listLogs, markRead, seedDemo } from "../lib/api";
import type { ImportResult } from "../lib/api";
import FiltersBar from "../components/FiltersBar";
import LogRow from "../components/LogRow";

type UiFilters = {
  q: string; level: string; section: string; from: string; to: string;
  hasReq: boolean; hasRes: boolean; unreadOnly: boolean;
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importingProgress, setImportingProgress] = useState<{ done: number; total: number } | null>(null);

  const [lastImport, setLastImport] =
    useState<{ imported: number; skipped: number; at: string; status: "ok" | "fail" } | null>(null);
  const [toast, setToast] = useState<string>("");

  const [filters, setFilters] = useState<UiFilters>({
    q: "", level: "", section: "", from: "", to: "",
    hasReq: false, hasRes: false, unreadOnly: false
  });
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);

  const visibleLogs = useMemo(() => {
    let arr = logs;
    if (filters.hasReq)     arr = arr.filter(l => !!l.has_req_body);
    if (filters.hasRes)     arr = arr.filter(l => !!l.has_res_body);
    if (filters.unreadOnly) arr = arr.filter(l => !l.is_read);
    return arr;
  }, [logs, filters.hasReq, filters.hasRes, filters.unreadOnly]);

  const breakdown = useMemo(() => {
    const c = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, TRACE: 0 } as Record<string, number>;
    for (const l of visibleLogs) if (l.level) c[l.level.toUpperCase()] = (c[l.level.toUpperCase()] ?? 0) + 1;
    return c;
  }, [visibleLogs]);

  async function fetchData() {
    setLoading(true);
    try {
      const data = await listLogs({
        q: filters.q,
        level: filters.level,
        section: filters.section,
        from: filters.from,
        to: filters.to,
        limit, offset,
        has_req_body: filters.hasReq,
        has_res_body: filters.hasRes,
        unread_only: filters.unreadOnly,
      });
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [JSON.stringify(filters), offset, limit]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  // Multi-file import with progress + auto-seed demo if no req/res found
  const onImportMany = async (files: File[]) => {
    setImporting(true);
    setImportingProgress({ done: 0, total: files.length });

    let totalImported = 0;
    let totalSkipped = 0;
    let failures = 0;

    for (let i = 0; i < files.length; i++) {
      try {
        const res: ImportResult = await importFile(files[i]);
        if (typeof res !== "string") {
          totalImported += res.imported ?? 0;
          totalSkipped  += res.skipped  ?? 0;
        }
      } catch {
        failures += 1;
      } finally {
        setImportingProgress({ done: i + 1, total: files.length });
      }
    }

    const now = new Date().toLocaleTimeString();
    const status: "ok" | "fail" = failures === files.length ? "fail" : "ok";
    setLastImport({ imported: totalImported, skipped: totalSkipped, at: now, status });

    await fetchData();

    // If after import we still don't have req/res anywhere — seed demo
    const hasBodies = (l: LogItem) => l.has_req_body || l.has_res_body;
    if (!logs.some(hasBodies)) {
      try {
        const s = await seedDemo();
        showToast(`Demo added (${s.inserted}) so you can show Req/Res.`);
        await fetchData();
      } catch { /* ignore */ }
    }

    showToast(
      failures
        ? `Imported ${totalImported} • Skipped ${totalSkipped} • Failed ${failures}`
        : `Imported ${totalImported} • Skipped ${totalSkipped}`
    );

    setOffset(0);
    setImporting(false);
    setImportingProgress(null);
  };

  const onMarked = async (id: number, is_read: boolean) => {
    try {
      await markRead(id, is_read);
      setLogs(prev => prev.map(l => (l.id === id ? { ...l, is_read } : l)));
    } catch { /* keep UI */ }
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Toast — bottom right to avoid overlapping the filters */}
      {toast && (
        <div style={{
          position: "fixed", right: 18, bottom: 18, zIndex: 50,
          padding: "10px 14px", borderRadius: 12, backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,.12)", background: "rgba(30,30,46,.75)"
        }}>
          {toast}
        </div>
      )}

      <FiltersBar
        onChange={setFilters}
        onImportMany={onImportMany}
        importing={importing}
        importingProgress={importingProgress}
        lastSummary={lastImport}
      />

      <div className="footer" role="status" aria-live="polite" style={{ marginTop: 10 }}>
        {lastImport
          ? <>
              Last import:&nbsp;
              <span className={`badge ${lastImport.status === "ok" ? "badge-info" : "badge-error"}`}>
                Imported {Number.isNaN(lastImport.imported) ? "N/A" : lastImport.imported}
              </span>
              &nbsp;·&nbsp;
              <span className="badge badge-debug">Skipped {Number.isNaN(lastImport.skipped) ? "N/A" : lastImport.skipped}</span>
              &nbsp;@ {lastImport.at}
            </>
          : <>No imports yet</>}
      </div>

      <div className="flex items-center justify-between text-sm my-3">
        <div>Shown: <b>{visibleLogs.length}</b></div>
        <div className="space-x-2">
          <button className="text-xs px-2 py-1 rounded border"
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}>Prev</button>
          <button className="text-xs px-2 py-1 rounded border"
                  onClick={() => setOffset(offset + limit)}>Next</button>
        </div>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : visibleLogs.length === 0 ? (
        <div className="text-sm text-slate-400">No logs match current filters.</div>
      ) : (
        visibleLogs.map(l => <LogRow key={l.id} log={l} onMarked={onMarked} />)
      )}

      <div className="footer" style={{ marginTop: 8 }}>
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