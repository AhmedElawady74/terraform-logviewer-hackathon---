from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..deps import get_db, require_api_key
from ..models import Log
import json

router = APIRouter(prefix="/export", tags=["export"])

@router.get("", summary="Export filtered logs NDJSON")
def export_all(
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
):
    """Stream logs as NDJSON for external tools (monitoring, incident mgmt)."""
    def gen():
        stmt = select(Log).order_by(Log.id)
        for row in db.execute(stmt).scalars():
            yield json.dumps({
                "id": row.id, "ts": row.ts, "level": row.level, "section": row.section,
                "tf_req_id": row.tf_req_id, "summary": row.summary
            }) + "\n"
    return StreamingResponse(gen(), media_type="application/x-ndjson",
                             headers={"Content-Disposition": "attachment; filename=logs.ndjson"})