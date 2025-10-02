# Parser for Terraform tflog NDJSON / JSON-array files.
# - Accepts both NDJSON (one JSON object per line) and a JSON array.
# - Supports keys with leading '@' used by tflog: @level, @message, @timestamp.
# - Robust to empty/garbled lines: skips them instead of failing the whole import.

import json
import io
from typing import Any, Iterable
from datetime import datetime
from sqlalchemy.orm import Session
from api.models import Log, Body
from .security_sanitizer import sanitize_dict


# ---------- Helpers: field extraction ----------

def _first(d: dict, *candidates: str, default=None):
    """Return the first present value for any of the candidate keys."""
    for k in candidates:
        if k in d:
            return d[k]
    return default


def _iso(ts: str | None) -> str:
    """Normalize timestamp string to ISO8601; fallback to current UTC."""
    if not ts:
        return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    # tflog already uses ISO8601 with TZ; we store as-is
    return ts


def _level(rec: dict) -> str:
    """Pick level from normal or '@' keys; else infer from message text."""
    lv = _first(rec, "level", "lvl", "severity", "@level")
    if isinstance(lv, str):
        return lv.upper()
    msg = json.dumps(rec, ensure_ascii=False).lower()
    for key in ("error", "warn", "info", "debug", "trace"):
        if key in msg:
            return key.upper()
    return "INFO"


def _section(rec: dict) -> str | None:
    """Heuristic for terraform phases based on message text."""
    msg = _first(rec, "summary", "msg", "message", "@message", default="")
    if not isinstance(msg, str):
        msg = str(msg)
    low = msg.lower()
    if "plan" in low and "start" in low:
        return "plan_start"
    if "plan" in low and "end" in low:
        return "plan_end"
    if "apply" in low and "start" in low:
        return "apply_start"
    if "apply" in low and "end" in low:
        return "apply_end"
    return rec.get("section")


def _req_id(rec: dict) -> str | None:
    """Extract request correlation id if present (usually not in tflog)."""
    return _first(rec, "tf_req_id", "req_id", "request_id", "x-request-id")


def _summary(rec: dict) -> str:
    """Short summary line used in lists."""
    text = _first(rec, "summary", "msg", "message", "@message", default="")
    if not text:
        text = json.dumps(rec, ensure_ascii=False)
    text = str(text).replace("\n", " ")
    return text[:150]


def _extract_bodies(rec: dict) -> tuple[Any | None, Any | None]:
    """Move potential request/response bodies into the bodies table."""
    req = _first(rec, "tf_http_req_body", "http_req_body")
    res = _first(rec, "tf_http_res_body", "http_res_body")
    return req, res


# ---------- Core import functions ----------

def _save_record(rec: dict, db: Session, count_ref: list[int]) -> None:
    """
    Sanitize a record and insert into DB.
    `count_ref` is a single-element list used to increment imported count by reference.
    """
    clean = sanitize_dict(rec)
    req, res = _extract_bodies(clean)

    ts_raw = _first(rec, "timestamp", "ts", "@timestamp")
    row = Log(
        ts=_iso(ts_raw),
        level=_level(rec),
        section=_section(rec),
        tf_req_id=_req_id(rec),
        summary=_summary(rec),
        has_req_body=bool(req),
        has_res_body=bool(res),
        raw_json=json.dumps(clean, ensure_ascii=False),
    )
    db.add(row)
    db.flush()  # get row.id

    if req is not None or res is not None:
        db.add(
            Body(
                log_id=row.id,
                req_body_json=json.dumps(req, ensure_ascii=False) if req is not None else None,
                res_body_json=json.dumps(res, ensure_ascii=False) if res is not None else None,
            )
        )

    count_ref[0] += 1


def _iter_ndjson(text: str) -> Iterable[dict]:
    """Yield JSON objects from NDJSON, skipping empty/invalid lines."""
    for line in io.StringIO(text):
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            if isinstance(obj, dict):
                yield obj
        except json.JSONDecodeError:
            # Skip malformed line
            continue


async def import_file_like(file_like, db: Session) -> int:
    """
    Import a file that can be NDJSON (tflog style) or a JSON array of objects.
    Returns the number of successfully imported records.
    """
    raw = await file_like.read()
    text = raw.decode("utf-8", errors="ignore").strip()

    imported = [0]  # list used as reference

    try:
        # Fast path for JSON array: starts with '['
        if text.startswith("["):
            data = json.loads(text)
            if isinstance(data, dict) and "records" in data:
                data = data["records"]
            if isinstance(data, list):
                for rec in data:
                    if isinstance(rec, dict):
                        _save_record(rec, db, imported)

        else:
            # Treat as NDJSON (Terraform tflog typical)
            for rec in _iter_ndjson(text):
                _save_record(rec, db, imported)

        db.commit()
        return imported[0]

    except Exception:
        db.rollback()
        raise