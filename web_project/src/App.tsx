import LogsPage from "./pages/LogsPage";

export default function App() {
  return (
    <>
      <header className="appbar">
        <div className="appbar-inner">
          <div className="brand"><b>Terraform</b>&nbsp;LogViewer</div>
          <nav className="nav">
            <a href="/app/">App</a>
            <a href="/docs" target="_blank" rel="noreferrer">API Docs</a>
          </nav>
        </div>
      </header>

      <main className="container">
        <h1 className="h1">Terraform LogViewer — Logs</h1>
        <LogsPage />
      </main>
    </>
  );
}