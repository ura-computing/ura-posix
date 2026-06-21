from fastapi import APIRouter
from sqlalchemy import text

from database import DbDep


router = APIRouter()


@router.get("/health")
def health(db: DbDep) -> dict:
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "down"
    return {"status": "ok", "db": db_status}