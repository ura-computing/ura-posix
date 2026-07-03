"""Tests for /v1/data/imports* — import-batches listing + soft-delete."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


@pytest.fixture
def import_batch(db: Session, auth_owner):
    """Insert an ImportBatch for the owner's pharmacy."""
    from models import ImportBatch
    _client, owner, pharmacy = auth_owner

    def _make(file_type: str = "achat", filename: str = "x.csv",
              created_by: int | None = None, deleted: bool = False):
        from datetime import datetime, timezone
        batch = ImportBatch(
            pharmacy_id=pharmacy.id,
            file_type=file_type,
            filename=filename,
            rows_inserted=10,
            rows_skipped=0,
            status="success",
            created_by_user_id=created_by if created_by is not None else owner.id,
        )
        if deleted:
            batch.deleted_at = datetime.now(timezone.utc)
            batch.deleted_by_user_id = owner.id
        db.add(batch)
        db.commit()
        db.refresh(batch)
        return batch

    return _make


class TestListImports:
    def test_empty_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/data/imports")
        assert r.status_code == 200
        body = r.json()
        assert body["data"] == []

    def test_with_rows(self, auth_owner, import_batch) -> None:
        client, _, _ = auth_owner
        import_batch(file_type="achat", filename="a.csv")
        import_batch(file_type="vente", filename="v.csv")
        r = client.get("/v1/data/imports")
        body = r.json()
        assert body["pagination"]["total"] == 2

    def test_includes_soft_deleted_inline(self, auth_owner, import_batch) -> None:
        # Per-role scope returns deleted rows too so the history shows.
        client, _, _ = auth_owner
        import_batch(deleted=True)
        r = client.get("/v1/data/imports")
        body = r.json()
        assert body["pagination"]["total"] == 1
        assert body["data"][0]["deleted_at"] is not None

    def test_unauthenticated(self, client: TestClient) -> None:
        r = client.get("/v1/data/imports")
        assert r.status_code == 401

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        set_pharmacy_features(p.id, ())
        r = client.get("/v1/data/imports")
        assert r.status_code == 403


class TestDeleteImport:
    def test_happy_path_soft_delete_achat(self, auth_owner, import_batch, db: Session) -> None:
        from models import ImportBatch
        client, _, _ = auth_owner
        batch = import_batch(file_type="achat")
        r = client.delete(f"/v1/data/imports/{batch.id}")
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == batch.id
        assert body["file_type"] == "achat"
        # Row stays but is soft-deleted.
        db.refresh(batch)
        assert batch.deleted_at is not None

    def test_stock_keeps_data(self, auth_owner, import_batch) -> None:
        # Stock variant: UPSERT can't be undone — endpoint returns 0 deleted_rows.
        client, _, _ = auth_owner
        batch = import_batch(file_type="stock")
        r = client.delete(f"/v1/data/imports/{batch.id}")
        assert r.status_code == 200
        assert r.json()["deleted_rows"] == 0

    def test_already_deleted_returns_409(self, auth_owner, import_batch) -> None:
        client, _, _ = auth_owner
        batch = import_batch(deleted=True)
        r = client.delete(f"/v1/data/imports/{batch.id}")
        assert r.status_code == 409

    def test_not_found(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.delete("/v1/data/imports/999999")
        assert r.status_code == 404

    def test_other_pharmacy_404(self, auth_owner, make_pharmacy, db: Session) -> None:
        # Insert a batch on another pharmacy; owner can't see/delete it.
        from models import ImportBatch
        client, _owner, _ = auth_owner
        other = make_pharmacy(name="OtherDataPh")
        b = ImportBatch(
            pharmacy_id=other.id, file_type="achat", filename="foreign.csv",
            rows_inserted=1, rows_skipped=0, status="success",
        )
        db.add(b)
        db.commit()
        db.refresh(b)
        r = client.delete(f"/v1/data/imports/{b.id}")
        assert r.status_code == 404

    def test_unauthenticated(self, client: TestClient) -> None:
        r = client.delete("/v1/data/imports/1")
        assert r.status_code == 401

    def test_missing_feature(self, auth_owner, import_batch, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        batch = import_batch()
        set_pharmacy_features(p.id, ())
        r = client.delete(f"/v1/data/imports/{batch.id}")
        assert r.status_code == 403
