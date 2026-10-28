"""Import shapes: JSON chunks from the browser wizard, batch status PATCH, import history."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, field_validator

from app.ingestion.csv_parse import fix_mojibake
from app.ledger.schemas import Pagination


# ═══ Uploads ═════════════════════════════════════════════════════════════════
# Import bodies: JSON chunks from the browser wizard + batch status PATCH.


class JsonUploadBody(BaseModel):
    rows: list[dict[str, str]]  # the import page serializes one row as {label: value, ...}
    filename: str | None = None
    batch_id: int | None = None

    @field_validator("rows")
    @classmethod
    def _repair_accents(cls, rows: list[dict[str, str]]) -> list[dict[str, str]]:
        """Browser-parsed rows skip csv_parse.clean_header / clean_value → repair
        broken accents here too (« Cat√©gorie » → « Catégorie »)."""
        return [{fix_mojibake(k) or k: fix_mojibake(v) or v for k, v in r.items()} for r in rows]


class PatchBatchBody(BaseModel):
    status: str
    error_message: str | None = None


# ═══ Import history ══════════════════════════════════════════════════════════
# Import history (/data/imports) shapes.


class ImportRow(BaseModel):
    id: int
    file_type: str
    filename: str | None
    rows_inserted: int
    rows_skipped: int
    status: str
    error_message: str | None
    imported_at: datetime
    created_by_full_name: str | None
    created_by_email: str | None
    deleted_at: datetime | None
    deleted_by_full_name: str | None
    deleted_by_email: str | None


class ImportsListResponse(BaseModel):
    data: list[ImportRow]
    pagination: Pagination
