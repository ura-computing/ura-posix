"""« Historique des modifications » (owner): every change of the pharmacy, kept as proof.

GET /v1/history   person, kind (all | imports | product | notes), date_from / date_to (pharmacy days),
                  search (product, file, note), page; export=true → every matching line (Excel).
A product's own lines: GET /v1/products/{med_id}/history (`app/products/router.py`, everyone with
Produits)."""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.core.database import DbDep
from app.core.permissions import OwnerDep
from app.history.history_queries import pharmacy_history
from app.history.schemas import HistoryResponse

router = APIRouter(tags=["history"])


@router.get("/history", response_model=HistoryResponse)
def get_history(
    pharmacy_id: OwnerDep,
    db: DbDep,
    person: Annotated[str | None, Query(description="exactly the name shown")] = None,
    kind: Annotated[str, Query(description="all | imports | product | notes")] = "all",
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    search: Annotated[str | None, Query(description="product, file, note text")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=200)] = 20,
    export: Annotated[bool, Query(description="every matching line (Excel)")] = False,
) -> dict:
    return pharmacy_history(
        db,
        pharmacy_id,
        person=person,
        kind=kind,
        date_from=date_from,
        date_to=date_to,
        search=search,
        page=page,
        limit=limit,
        export=export,
    )
