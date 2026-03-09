import os
from dotenv import load_dotenv
load_dotenv()

from typing import List

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, Base, get_db
from models import CategorySuffix
from schemas import CategorySuffixOut
from routers import achat, admin, auth, catalog_requests, data, owner, public, uploads, vente
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

app.include_router(auth.router)
app.include_router(public.router)
app.include_router(uploads.router)
app.include_router(achat.router)
app.include_router(vente.router)
app.include_router(data.router)
app.include_router(admin.router)
app.include_router(owner.router)
app.include_router(catalog_requests.router)
app.include_router(stats_router)


_DEFAULTS = [
    ("Médicament", "-1"),
    ("Parapharmacie", "-1"),
    ("Complément Alimentaire", "-2"),
    ("Homéopathie", "-3"),
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
