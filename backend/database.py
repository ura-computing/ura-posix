import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

_env_name = os.getenv("APP_ENV", "dev")
_env_file = Path(__file__).resolve().parent.parent / "env" / _env_name / "backend.env"
if _env_file.exists():
    load_dotenv(_env_file)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set in backend/.env")
# Render uses postgres:// but SQLAlchemy requires postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}

# Pool sizing — keep total below DO managed-DB limits (Dev tier caps at ~22 connections).
# pool_pre_ping checks each connection before use (avoids using stale ones DO has dropped).
# pool_recycle drops connections older than 300s so DO's idle-timeout never bites us.
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_size=int(os.getenv("DB_POOL_SIZE", "5")),
    max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "5")),
    pool_pre_ping=True,
    pool_recycle=300,
    pool_timeout=30,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
