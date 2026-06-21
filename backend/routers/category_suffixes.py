"""Admin-only CRUD for category_suffixes.

CategorySuffix is a GLOBAL table (one row per category across all pharmacies)
so it's edited by admins, not pharmacy owners. The Ventes serializer reads
this table per request and embeds the (suffix, color) in each vente row so
the frontend doesn't need its own /category-suffixes lookup.

Frontend admin UI lives on /parametres > Catégories (a future tab). For now
admins manage via CLI or direct HTTP.

Allowed `color` values mirror the frontend's SuffixBadge palette.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel, Field, field_validator

from database import DbDep
from models import CategorySuffix
from permissions import require_admin
from security import CurrentUserDep


router = APIRouter(tags=["category-suffixes"])


ALLOWED_COLORS = frozenset({"teal", "blue", "purple", "amber", "rose", "emerald", "orange", "pink"})


class CategorySuffixIn(BaseModel):
    category: str = Field(min_length=1, max_length=200)
    suffix:   str = Field(min_length=1, max_length=20)
    color:    str | None = None

    @field_validator("color")
    @classmethod
    def _color_in_palette(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        if v not in ALLOWED_COLORS:
            raise ValueError(f"color must be one of {sorted(ALLOWED_COLORS)}")
        return v


class CategorySuffixOut(BaseModel):
    id:       int
    category: str
    suffix:   str
    color:    str | None


@router.get("/category-suffixes", response_model=list[CategorySuffixOut])
def list_category_suffixes(user: CurrentUserDep, db: DbDep) -> list[CategorySuffix]:
    require_admin(user)
    return db.query(CategorySuffix).order_by(CategorySuffix.category).all()


@router.post("/category-suffixes", response_model=CategorySuffixOut, status_code=201)
def create_category_suffix(body: CategorySuffixIn, user: CurrentUserDep, db: DbDep) -> CategorySuffix:
    require_admin(user)
    if db.query(CategorySuffix).filter(CategorySuffix.category == body.category).first():
        raise HTTPException(status_code=409, detail=f"La catégorie « {body.category} » a déjà un suffixe.")
    row = CategorySuffix(category=body.category, suffix=body.suffix, color=body.color)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/category-suffixes/{suffix_id}", response_model=CategorySuffixOut)
def update_category_suffix(
    suffix_id: Annotated[int, Path(ge=1)],
    body:      CategorySuffixIn,
    user:      CurrentUserDep,
    db:        DbDep,
) -> CategorySuffix:
    require_admin(user)
    row = db.get(CategorySuffix, suffix_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Suffixe introuvable.")
    if body.category != row.category and db.query(CategorySuffix).filter(CategorySuffix.category == body.category).first():
        raise HTTPException(status_code=409, detail=f"La catégorie « {body.category} » a déjà un suffixe.")
    row.category = body.category
    row.suffix   = body.suffix
    row.color    = body.color
    db.commit()
    db.refresh(row)
    return row


@router.delete("/category-suffixes/{suffix_id}", status_code=204)
def delete_category_suffix(
    suffix_id: Annotated[int, Path(ge=1)],
    user:      CurrentUserDep,
    db:        DbDep,
) -> None:
    require_admin(user)
    row = db.get(CategorySuffix, suffix_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Suffixe introuvable.")
    db.delete(row)
    db.commit()