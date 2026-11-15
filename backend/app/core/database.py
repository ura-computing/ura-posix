from typing import Annotated, Iterator

from fastapi import Depends
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


# One pool per process, all of them inside the managed Postgres' 22 connections (25 − 3 reserved for its superuser):
#
#   API      WEB_CONCURRENCY 2 processes × (DB_POOL_SIZE 4 + DB_MAX_OVERFLOW 4) = 16
#   worker   1 process × (2 + 1, set by entrypoint.sh worker) + its LISTEN connection = 4
#   total    20, 2 left (console, a deploy's new instance starting)
#
# A request that finds the pool busy waits up to pool_timeout for a free connection instead of asking Postgres for one
# more: before (10 + 20 per process, 2026-11-12) a burst of requests went past 22 and Postgres refused them (500).
# More processes or instances → lower DB_POOL_SIZE / DB_MAX_OVERFLOW so the total stays ≤ 22; a bigger database plan →
# raise them (env vars, no code change). pool_recycle: the managed Postgres drops idle connections.
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=30,
    pool_recycle=1800,
)


# A query running longer than DB_STATEMENT_TIMEOUT_MS is stopped by Postgres: its request fails alone (500, its traceback
# in the log) instead of keeping a connection while the others wait for the pool and fail too. Example: the dashboard
# asked with no dates over a whole history on the 1-vCPU database. Set on each new connection (works the same through
# DigitalOcean's connection pool); 0 = no limit (the worker: entrypoint.sh).
@event.listens_for(engine, "connect")
def _statement_timeout(dbapi_connection, _record) -> None:
    if settings.DB_STATEMENT_TIMEOUT_MS > 0:
        with dbapi_connection.cursor() as cursor:
            cursor.execute(f"SET statement_timeout = {int(settings.DB_STATEMENT_TIMEOUT_MS)}")
        dbapi_connection.commit()


SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


DbDep = Annotated[Session, Depends(get_db)]
