from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Text, Boolean, ForeignKey
from pydantic import BaseModel
from .db import Base

class Log(Base):
    """Main log row with lightweight fields and a text JSON column."""
    __tablename__ = "logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts: Mapped[str] = mapped_column(String(32), index=True)  # ISO8601 timestamp
    level: Mapped[str] = mapped_column(String(16), index=True, default="INFO")
    section: Mapped[str] = mapped_column(String(32), index=True, nullable=True)  # plan/apply markers
    tf_req_id: Mapped[str] = mapped_column(String(64), index=True, nullable=True)  # request grouping
    summary: Mapped[str] = mapped_column(String(512))  # short message
    has_req_body: Mapped[bool] = mapped_column(Boolean, default=False)
    has_res_body: Mapped[bool] = mapped_column(Boolean, default=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    raw_json: Mapped[str] = mapped_column(Text)  # sanitized original JSON as text

    body: Mapped["Body"] = relationship(back_populates="log", uselist=False)

class Body(Base):
    """Holds lazy-loaded request/response JSON blobs for a log row."""
    __tablename__ = "bodies"
    log_id: Mapped[int] = mapped_column(ForeignKey("logs.id"), primary_key=True)
    req_body_json: Mapped[str] = mapped_column(Text, nullable=True)
    res_body_json: Mapped[str] = mapped_column(Text, nullable=True)
    log: Mapped[Log] = relationship(back_populates="body")

# ---- Pydantic response schemas ----
class LogOut(BaseModel):
    id: int
    ts: str
    level: str
    section: str | None
    tf_req_id: str | None
    summary: str
    has_req_body: bool
    has_res_body: bool
    is_read: bool
    class Config:
        from_attributes = True  # allows ORM -> Pydantic conversion

class LogDetail(LogOut):
    raw_json: str