from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles           # serve built frontend
from fastapi.responses import FileResponse            # serve favicon (optional)
import os, time
from collections import defaultdict

from .db import init_db
from .routers import import_router, logs_router, search_router, timeline_router, export_router

# -------- DB initialization --------
init_db()

# -------- FastAPI app --------
app = FastAPI(title="Terraform LogViewer API", version="1.0")

# CORS: allow both the dev UI (5173) and the served UI (/app on 8000)
# NOTE: you can override with CORS_ORIGINS env var: "http://localhost:5173,http://localhost:8000"
origins = [o.strip() for o in os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://localhost:8000"
).split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------- Tiny in-memory rate limit (per API key / IP) --------
RATE_LIMIT = int(os.getenv("RATE_LIMIT", "120"))   # requests per window
RATE_WINDOW = int(os.getenv("RATE_WINDOW", "60"))  # window seconds
_buckets: dict[str, list[float]] = defaultdict(list)

@app.middleware("http")
async def rate_limiter(request: Request, call_next):
    key = request.headers.get("X-API-Key") or f"ip:{request.client.host if request.client else 'unknown'}"
    now = time.time()
    bucket = _buckets[key]
    cutoff = now - RATE_WINDOW
    while bucket and bucket[0] < cutoff:
        bucket.pop(0)
    if len(bucket) >= RATE_LIMIT:
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": "Rate limit exceeded"}, status_code=429)
    bucket.append(now)
    return await call_next(request)

# -------- API routers --------
app.include_router(import_router.router)
app.include_router(logs_router.router)
app.include_router(search_router.router)
app.include_router(timeline_router.router)
app.include_router(export_router.router)

# -------- Serve built Web UI at /app (Vite `npm run build`) --------
# FRONTEND_DIR is relative to the process working dir (project root when you run uvicorn)
FRONTEND_DIR = os.getenv("FRONTEND_DIR", "web_project/dist")
if os.path.isdir(FRONTEND_DIR):
    # html=True makes index.html returned for unknown paths (SPA routing)
    app.mount("/app", StaticFiles(directory=FRONTEND_DIR, html=True), name="app")

# Optional: favicon handler to avoid noisy 404s in logs
@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    # try common locations
    candidates = [
        os.path.join("static", "favicon.ico"),
        os.path.join(FRONTEND_DIR, "favicon.ico"),
    ]
    for p in candidates:
        if os.path.exists(p):
            return FileResponse(p)
    return Response(status_code=204)  # silent "no favicon"

# Root health-check (keep for monitoring/tools)
@app.get("/")
def root():
    return {"ok": True, "service": "terraform-logviewer"}

# OPTIONAL: if you want "/" to open the UI instead of JSON, uncomment:
# from fastapi.responses import RedirectResponse
# @app.get("/", include_in_schema=False)
# def root_redirect():
#     return RedirectResponse(url="/app")