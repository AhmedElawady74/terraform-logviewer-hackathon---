from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from ..deps import get_db, require_api_key
from ..models import Log

router = APIRouter(prefix="/timeline", tags=["timeline"])

@router.get("", summary="Aggregate by tf_req_id")
def timeline(
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
):
    """Return start/end/count per tf_req_id to build a simple Gantt/flow view."""
    stmt = (
        select(
            Log.tf_req_id,
            func.min(Log.ts).label("start"),
            func.max(Log.ts).label("end"),
            func.count().label("count")
        )
        .where(Log.tf_req_id.is_not(None))
        .group_by(Log.tf_req_id)
        .order_by("start")
    )
    items = [dict(tf_req_id=r[0], start=r[1], end=r[2], count=r[3]) for r in db.execute(stmt).all()]
    return {"items": items}