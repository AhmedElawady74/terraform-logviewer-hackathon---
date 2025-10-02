from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..deps import get_db, require_api_key
from ..models import Log, Body, LogOut, LogDetail

router = APIRouter(prefix="/logs", tags=["logs"])

@router.get("", response_model=list[LogOut], summary="List")
def list_logs(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
):
    """List log rows (without heavy bodies), paginated."""
    rows = db.execute(select(Log).order_by(Log.id).limit(limit).offset(offset)).scalars().all()
    return rows

@router.get("/{log_id}", response_model=LogDetail, summary="Get")
def get_log(
    log_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key)
):
    """Fetch a single log row including raw_json."""
    row = db.get(Log, log_id)
    if not row:
        raise HTTPException(404, "Log not found")
    return row

@router.get("/{log_id}/body", summary="Body")
def get_body(
    log_id: int,
    part: str = Query("req", pattern="^(req|res)$"),
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
):
    """Lazy fetch request or response JSON for a log."""
    b = db.get(Body, log_id)
    if not b:
        raise HTTPException(404, "No body")
    return {"part": part, "json": b.req_body_json if part == "req" else b.res_body_json}

@router.patch("/{log_id}/read", summary="Mark as read")
def mark_read(
    log_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
):
    """Mark a log as 'read' to hide it from anomaly views later."""
    row = db.get(Log, log_id)
    if not row:
        raise HTTPException(404, "Not found")
    row.is_read = True
    db.commit()
    return {"ok": True}