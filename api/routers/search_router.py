from fastapi import APIRouter, Depends, Query
from sqlalchemy import text, select, and_
from sqlalchemy.orm import Session
from ..deps import get_db, require_api_key
from ..models import Log, LogOut

router = APIRouter(prefix="/search", tags=["search"])

@router.get("", response_model=list[LogOut])
def search(
    q: str | None = Query(None, description="full-text over summary/raw_json"),
    level: str | None = None,
    tf_req_id: str | None = None,
    from_ts: str | None = None,
    to_ts: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
):
    """Compound search: filters + optional FTS5 match over summary/raw_json."""
    # Base filters
    stmt = select(Log)
    conds = []
    if level: conds.append(Log.level == level)
    if tf_req_id: conds.append(Log.tf_req_id == tf_req_id)
    if from_ts: conds.append(Log.ts >= from_ts)
    if to_ts: conds.append(Log.ts <= to_ts)
    if conds:
        stmt = stmt.where(and_(*conds))
    # Full-text search (if q is provided)
    if q:
        stmt = stmt.join(text("logs_fts ON logs_fts.rowid = logs.id")) \
                   .where(text("logs_fts MATCH :qq")).params(qq=q)
    stmt = stmt.order_by(Log.ts).limit(limit).offset(offset)
    return db.execute(stmt).scalars().all()