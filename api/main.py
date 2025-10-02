# api/main.py
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os, time
from collections import defaultdict

from .db import init_db
from .routers import import_router, logs_router, search_router, timeline_router, export_router
from .routers.demo_router import router as demo_router  # NEW

# Initialize DB + FTS5/triggers
init_db()

app = FastAPI(title="Terraform LogViewer API", version="1.0")

# CORS: allow your Web UI origin (Vite on 5173)
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# Very small in-memory rate limit
RATE_LIMIT = int(os.getenv("RATE_LIMIT", "120"))     # req per window
RATE_WINDOW = int(os.getenv("RATE_WINDOW", "60"))    # seconds
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

# Routers
app.include_router(import_router.router)
app.include_router(demo_router)              # NEW
app.include_router(logs_router.router)
app.include_router(search_router.router)
app.include_router(timeline_router.router)
app.include_router(export_router.router)

# Serve the built SPA on /app
app.mount("/app", StaticFiles(directory="web_project/dist", html=True), name="app")

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    path = "static/favicon.ico"
    if os.path.exists(path):
        return FileResponse(path)
    return Response(status_code=204)

@app.get("/")
def root():
    return {"ok": True, "service": "terraform-logviewer"}