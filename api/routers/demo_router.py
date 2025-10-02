from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from api.deps import get_db
from api.models import Log, Body
from datetime import datetime, timedelta

router = APIRouter(prefix="/import", tags=["import"])

@router.post("/demo")
def seed_demo(db: Session = Depends(get_db)):
    """
    Insert a small demo dataset that includes Req/Res bodies,
    useful when user logs have no bodies.
    """
    now = datetime.utcnow()
    samples = [
        {
            "level": "INFO",
            "summary": "GET /v1/users",
            "section": "apply",
            "req": '{"method":"GET","path":"/v1/users"}',
            "res": '{"status":200,"items":3}',
            "delta": 0,
        },
        {
            "level": "ERROR",
            "summary": "POST /v1/orders failed",
            "section": "apply",
            "req": '{"method":"POST","path":"/v1/orders","body":{"sku":"ABC","qty":2}}',
            "res": '{"status":500,"error":"db timeout"}',
            "delta": 1,
        },
        {
            "level": "DEBUG",
            "summary": "Provider X handshake",
            "section": "provider",
            "req": '{"hello":"provider"}',
            "res": '{"ok":true}',
            "delta": 2,
        },
        {
            "level": "INFO",
            "summary": "Plan summary: 2 to add, 0 to change, 0 to destroy",
            "section": "plan",
            "req": None,
            "res": None,
            "delta": 3,
        },
    ]

    for s in samples:
        ts = (now + timedelta(seconds=s["delta"])).isoformat() + "Z"
        log = Log(
            level=s["level"],
            summary=s["summary"],
            ts=ts,
            section=s["section"],
            has_req_body=bool(s["req"]),
            has_res_body=bool(s["res"]),
            is_read=False,
            tf_req_id=None,
        )
        db.add(log); db.flush()
        if s["req"] or s["res"]:
            db.add(Body(log_id=log.id, req=s["req"], res=s["res"]))

    db.commit()
    return {"ok": True, "inserted": len(samples)}