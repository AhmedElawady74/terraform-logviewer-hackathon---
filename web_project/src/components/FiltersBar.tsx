import { useEffect, useRef, useState } from "react";

type Filters = {
  q: string; level: string; section: string; from: string; to: string;
  hasReq: boolean; hasRes: boolean; unreadOnly: boolean;
};

export default function FiltersBar({
  onChange,
  onImportMany,
  importing,
  importingProgress,
  lastSummary,
}: {
  onChange: (f: Filters) => void;
  onImportMany: (files: File[]) => Promise<void>;
  importing?: boolean;
  importingProgress?: { done: number; total: number } | null;
  lastSummary?: { imported: number; skipped: number; at: string; status: "ok" | "fail" } | null;
}) {
  const [f, setF] = useState<Filters>({
    q: "", level: "", section: "", from: "", to: "",
    hasReq: false, hasRes: false, unreadOnly: false,
  });

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => onChange(f), 200);
    return () => clearTimeout(id);
  }, [f, onChange]);

  const pickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    const files = Array.from(list).slice(0, 20);
    try { await onImportMany(files); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };

  const importingLabel = importing && importingProgress
    ? `Importing… ${importingProgress.done}/${importingProgress.total}`
    : importing ? "Importing…" : "Import files";

  return (
    <div className="toolbar" style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr", gap: 8 }}>
        <input className="input" placeholder="Search (full-text)…"
               value={f.q} onChange={e => setF({ ...f, q: e.target.value })} />

        <select className="input" value={f.level} onChange={e => setF({ ...f, level: e.target.value })}>
          <option value="">Level</option>
          <option>ERROR</option><option>WARN</option><option>INFO</option>
          <option>DEBUG</option><option>TRACE</option>
        </select>

        <select className="input" value={f.section} onChange={e => setF({ ...f, section: e.target.value })}>
          <option value="">Section</option>
          <option value="core">core</option>
          <option value="provider">provider</option>
          <option value="plan">plan</option>
          <option value="apply">apply</option>
        </select>

        <input className="input" type="date" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} />
        <input className="input" type="date" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={f.hasReq} onChange={e => setF({ ...f, hasReq: e.target.checked })} />
          <span>Req body</span>
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={f.hasRes} onChange={e => setF({ ...f, hasRes: e.target.checked })} />
          <span>Res body</span>
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={f.unreadOnly} onChange={e => setF({ ...f, unreadOnly: e.target.checked })} />
          <span>Unread only</span>
        </label>

        {lastSummary && (
          <span className="badge"
                style={{
                  border: "1px solid rgba(255,255,255,.12)",
                  background: "rgba(30,30,46,.55)",
                  padding: "6px 10px", borderRadius: 10, fontSize: 12
                }}>
            Imported {Number.isNaN(lastSummary.imported) ? "N/A" : lastSummary.imported}
            {" · "}
            Skipped {Number.isNaN(lastSummary.skipped) ? "N/A" : lastSummary.skipped}
          </span>
        )}

        <button className="button primary" onClick={() => fileRef.current?.click()} disabled={!!importing}>
          {importingLabel}
        </button>
        <input
          ref={fileRef}
          type="file"
          style={{ display: "none" }}
          multiple
          accept=".json,.ndjson,.log,.txt,application/json"
          onChange={pickFiles}
        />
      </div>
    </div>
  );
}
