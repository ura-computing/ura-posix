from typing import Annotated, Iterator

from fastapi import Depends
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from config import settings


# Single-process deployment (no --workers, see entrypoint.sh) — every tenant
# shares this one pool. SQLAlchemy's bare defaults (pool_size=5,
# max_overflow=10) proved too thin: a handful of slow requests from one
# pharmacy (e.g. an unindexed catalog scan during import — see migration
# 0019) could exhaust all 15 slots and time out unrelated tenants'
# requests. Widened as a stop-gap headroom bump, not a fix for slow queries
# themselves. pool_recycle guards against the managed Postgres side dropping
# idle connections out from under us. Check the DB plan's max_connections
# before raising these further — this backend is presumably not the only
# consumer of that budget.
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,
)
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