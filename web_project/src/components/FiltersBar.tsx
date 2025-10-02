import { useEffect, useRef, useState } from "react";

type Filters = { q: string; level: string; section: string; from: string; to: string };

export default function FiltersBar({
  onChange,
  onImport,
  importing,
}: {
  onChange: (f: Filters) => void;
  onImport: (file: File) => Promise<void>;
  importing?: boolean;
}) {
  const [f, setF] = useState<Filters>({ q: "", level: "", section: "", from: "", to: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { onChange(f); }, [f, onChange]);

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await onImport(file);
    } finally {
      // Important: reset the value so selecting the same file triggers onChange again
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="toolbar">
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
      <span>—</span>
      <input className="input" type="date" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} />

      {/* Pretty upload button + hidden file input */}
      <button className="button primary" style={{ marginLeft: "auto" }}
              onClick={() => fileRef.current?.click()} disabled={!!importing}>
        {importing ? "Importing…" : "Import file"}
      </button>
      <input
        ref={fileRef}
        type="file"
        style={{ display: "none" }}
        accept=".json,.ndjson,.log,.txt,application/json"
        onChange={pickFile}
      />
    </div>
  );
}