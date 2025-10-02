from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import DeclarativeBase
import os

# DB file path from env; ensures ./data exists
DB_PATH = os.getenv("DB_PATH", "./data/logs.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

# SQLite engine; check_same_thread False to allow use in FastAPI threads
engine = create_engine(
    f"sqlite:///{DB_PATH}", echo=False, future=True,
    connect_args={"check_same_thread": False}
)
# Session factory
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

class Base(DeclarativeBase):
    """Base class for SQLAlchemy ORM models."""
    pass

def init_db():
    """Create tables and FTS5 virtual table + triggers for full-text search."""
    from .models import Log, Body
    Base.metadata.create_all(bind=engine)
    # Create FTS5 virtual table (summary + raw_json) and keep it in sync via triggers
    with engine.begin() as conn:
        conn.exec_driver_sql("""
        CREATE VIRTUAL TABLE IF NOT EXISTS logs_fts USING fts5(
            log_id UNINDEXED,
            summary,
            raw_json
        );
        """)
        # Insert trigger
        conn.exec_driver_sql("""
        CREATE TRIGGER IF NOT EXISTS logs_ai AFTER INSERT ON logs BEGIN
          INSERT INTO logs_fts(rowid, log_id, summary, raw_json)
          VALUES (new.id, new.id, new.summary, new.raw_json);
        END;
        """)
        # Delete trigger
        conn.exec_driver_sql("""
        CREATE TRIGGER IF NOT EXISTS logs_ad AFTER DELETE ON logs BEGIN
          DELETE FROM logs_fts WHERE rowid = old.id;
        END;
        """)
        # Update trigger
        conn.exec_driver_sql("""
        CREATE TRIGGER IF NOT EXISTS logs_au AFTER UPDATE ON logs BEGIN
          UPDATE logs_fts SET summary = new.summary, raw_json = new.raw_json
           WHERE rowid = new.id;
        END;
        """)