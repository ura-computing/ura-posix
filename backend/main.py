import logging
import os
import time
from dotenv import load_dotenv
load_dotenv()

from typing import List

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("apcm")
from sqlalchemy.orm import Session

from database import engine, Base, get_db
from models import CategorySuffix
from schemas import CategorySuffixOut
from routers import admin, auth, catalog_requests, data, owner, public, uploads
from routers.transactions import achat_router, vente_router
from routers.stats import router as stats_router
from routers.auth import get_current_user
from models import User

Base.metadata.create_all(bind=engine)

app = FastAPI(title="PharmaGest API", version="1.0.0")

_cors_origins = os.getenv("CORS_ORIGINS", "*")
_allow_origins = ["*"] if _cors_origins == "*" else [o.strip() for o in _cors_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration = (time.perf_counter() - start) * 1000
    logger.info("%s %s → %s  (%.1fms)", request.method, request.url.path, response.status_code, duration)
    return response


app.include_router(auth.router)
app.include_router(public.router)
app.include_router(uploads.router)
app.include_router(achat_router)
app.include_router(vente_router)
app.include_router(data.router)
app.include_router(admin.router)
app.include_router(owner.router)
app.include_router(catalog_requests.router)
app.include_router(stats_router)


_DEFAULTS = [
    ("Medicament", "-1"),
    ("Parapharmacie", "-1"),
    ("Complement Alimentaire", "-2"),
    ("Homeopathie", "-3"),
]


@app.on_event("startup")
def seed_category_suffixes():
    """Insert default category→suffix mappings if the table is empty."""
    db: Session = next(get_db())
    try:
        if db.query(CategorySuffix).count() == 0:
            for cat, suf in _DEFAULTS:
                db.add(CategorySuffix(category=cat, suffix=suf))
            db.commit()
    finally:
        db.close()


@app.get("/category-suffixes", response_model=List[CategorySuffixOut], tags=["category-suffixes"])
def get_category_suffixes(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return all category→suffix mappings. Available to all authenticated users."""
    return db.query(CategorySuffix).order_by(CategorySuffix.category).all()


@app.get("/health")
def health():
    return {"status": "ok"}
