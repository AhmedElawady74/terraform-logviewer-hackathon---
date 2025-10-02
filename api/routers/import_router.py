from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from ..deps import get_db, require_api_key
from parser.main import import_file_like

router = APIRouter(prefix="/import", tags=["import"])

@router.post("", summary="Import File")
async def import_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: None = Depends(require_api_key),
):
    """Accept a log file (NDJSON or JSON array) and ingest it into SQLite."""
    if not file.filename:
        raise HTTPException(400, "No filename")
    count = await import_file_like(file, db)
    return {"imported": count}