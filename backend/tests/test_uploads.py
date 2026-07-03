"""Tests for /v1/uploads/* — CSV + JSON upload + batch PATCH.

Most upload endpoints require BOTH `import` AND the doc-type feature
(achats / ventes / stock). Catalog is admin-only multipart.
"""
from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


# ── Shared fixtures ───────────────────────────────────────────────────────

@pytest.fixture
def achat_csv_bytes() -> bytes:
    # Sobrus column headers; one row that parses cleanly.
    return (
        b'"Cre\xcc\x81e\xcc\x81e le";"Date Bon de Livraison";"Re\xcc\x81fe\xcc\x81rence de livraison";'
        b'"Fournisseur";"PID";"Produit";"TVA";"PPH";"PPV";"Cate\xcc\x81gorie";"Zone";"Quantite\xcc\x81";"Prix unitaire";"Date de pe\xcc\x81remption";"Stock min";"Stock max";"Total"\n'
        b'"2026-01-15 10:00:00";"2026-01-15";"BL-1";"Sup A";"PIDX1";"Med X";"TVA (20.00%)";"10";"15";"Medicament";"";"2";"15";"";"";"";"30"\n'
    )


@pytest.fixture
def achat_json_body() -> dict:
    return {
        "rows": [{
            "PID": "PIDX1", "Produit": "Med X",
            "Date Bon de Livraison": "2026-01-15",
            "Référence de livraison": "BL-JSON-1",
            "Fournisseur": "Sup", "Quantité": "2",
            "Prix unitaire": "15", "Total": "30",
            "TVA": "TVA (20.00%)", "PPH": "10", "PPV": "15",
        }],
        "filename": "test.csv",
    }


@pytest.fixture
def vente_json_body() -> dict:
    return {
        "rows": [{
            "PID": "PIDY1", "Produit": "Med Y",
            "Date": "2026-01-20",
            "Numéro de transaction": "T-1",
            "Client": "Walk-in", "Quantité": "1",
            "Prix unitaire": "50", "Total": "50",
            "TVA": "TVA (20.00%)",
        }],
        "filename": "v.csv",
    }


@pytest.fixture
def stock_json_body() -> dict:
    return {
        "rows": [{
            "PID": "PIDZ1", "Produit": "Med Z",
            "Stock": "100", "Stock min": "10", "Stock max": "200",
            "Catégorie": "Medicament", "Zone": "", "TVA": "TVA (20.00%)",
            "PPH": "10", "PPV": "15",
        }],
        "filename": "s.csv",
    }


# ══ /uploads/achat-json ════════════════════════════════════════════════════

class TestUploadAchatJson:
    def test_happy_path(self, auth_owner, achat_json_body) -> None:
        client, _, _ = auth_owner
        r = client.post("/v1/uploads/achat-json", json=achat_json_body)
        assert r.status_code == 200
        body = r.json()
        assert body["inserted"] == 1

    def test_empty_rows_returns_400(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.post("/v1/uploads/achat-json", json={"rows": [], "filename": "x.csv"})
        assert r.status_code == 400

    def test_unauthenticated(self, client: TestClient, achat_json_body) -> None:
        r = client.post("/v1/uploads/achat-json", json=achat_json_body)
        assert r.status_code == 401

    def test_admin_forbidden(self, auth_admin, achat_json_body) -> None:
        client, _ = auth_admin
        r = client.post("/v1/uploads/achat-json", json=achat_json_body)
        assert r.status_code == 403

    def test_missing_import_feature(self, auth_owner, achat_json_body, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        # Grant achats but NOT import → still 403 because BOTH are required.
        set_pharmacy_features(p.id, ("achats",))
        r = client.post("/v1/uploads/achat-json", json=achat_json_body)
        assert r.status_code == 403

    def test_missing_achats_feature(self, auth_owner, achat_json_body, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        # Grant import but NOT achats → 403 (per-type gate).
        set_pharmacy_features(p.id, ("import",))
        r = client.post("/v1/uploads/achat-json", json=achat_json_body)
        assert r.status_code == 403


# ══ /uploads/vente-json ════════════════════════════════════════════════════

class TestUploadVenteJson:
    def test_happy_path(self, auth_owner, vente_json_body) -> None:
        client, _, _ = auth_owner
        r = client.post("/v1/uploads/vente-json", json=vente_json_body)
        assert r.status_code == 200

    def test_empty_rows_returns_400(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.post("/v1/uploads/vente-json", json={"rows": [], "filename": "x"})
        assert r.status_code == 400

    def test_unauthenticated(self, client: TestClient, vente_json_body) -> None:
        r = client.post("/v1/uploads/vente-json", json=vente_json_body)
        assert r.status_code == 401

    def test_admin_forbidden(self, auth_admin, vente_json_body) -> None:
        client, _ = auth_admin
        r = client.post("/v1/uploads/vente-json", json=vente_json_body)
        assert r.status_code == 403

    def test_missing_ventes_feature(self, auth_owner, vente_json_body, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        set_pharmacy_features(p.id, ("import",))   # missing ventes
        r = client.post("/v1/uploads/vente-json", json=vente_json_body)
        assert r.status_code == 403


# ══ /uploads/stock-json ════════════════════════════════════════════════════

class TestUploadStockJson:
    def test_happy_path(self, auth_owner, stock_json_body) -> None:
        client, _, _ = auth_owner
        r = client.post("/v1/uploads/stock-json", json=stock_json_body)
        assert r.status_code == 200

    def test_admin_forbidden(self, auth_admin, stock_json_body) -> None:
        client, _ = auth_admin
        r = client.post("/v1/uploads/stock-json", json=stock_json_body)
        assert r.status_code == 403

    def test_missing_stock_feature(self, auth_owner, stock_json_body, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        set_pharmacy_features(p.id, ("import",))
        r = client.post("/v1/uploads/stock-json", json=stock_json_body)
        assert r.status_code == 403


# ══ /uploads/achat + /uploads/vente (multipart) ════════════════════════════

class TestUploadAchatMultipart:
    def test_happy_path(self, auth_owner, achat_csv_bytes) -> None:
        client, _, _ = auth_owner
        r = client.post(
            "/v1/uploads/achat",
            files={"file": ("test.csv", io.BytesIO(achat_csv_bytes), "text/csv")},
        )
        assert r.status_code == 200, r.text

    def test_unauthenticated(self, client: TestClient) -> None:
        r = client.post(
            "/v1/uploads/achat",
            files={"file": ("x.csv", io.BytesIO(b"PID\n"), "text/csv")},
        )
        assert r.status_code == 401

    def test_admin_forbidden(self, auth_admin, achat_csv_bytes) -> None:
        client, _ = auth_admin
        r = client.post(
            "/v1/uploads/achat",
            files={"file": ("x.csv", io.BytesIO(achat_csv_bytes), "text/csv")},
        )
        assert r.status_code == 403


class TestUploadVenteMultipart:
    def test_unauthenticated(self, client: TestClient) -> None:
        r = client.post(
            "/v1/uploads/vente",
            files={"file": ("x.csv", io.BytesIO(b"PID\n"), "text/csv")},
        )
        assert r.status_code == 401

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.post(
            "/v1/uploads/vente",
            files={"file": ("x.csv", io.BytesIO(b"PID\n"), "text/csv")},
        )
        assert r.status_code == 403


# ══ /uploads/catalog (admin only) ══════════════════════════════════════════

class TestUploadCatalog:
    def test_unauthenticated(self, client: TestClient) -> None:
        r = client.post(
            "/v1/uploads/catalog",
            files={"file": ("c.csv", io.BytesIO(b"Nom,TVA\n"), "text/csv")},
        )
        assert r.status_code == 401

    def test_owner_forbidden(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.post(
            "/v1/uploads/catalog",
            files={"file": ("c.csv", io.BytesIO(b"Nom,TVA\n"), "text/csv")},
        )
        assert r.status_code == 403

    def test_admin_empty_csv_returns_400(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.post(
            "/v1/uploads/catalog",
            files={"file": ("c.csv", io.BytesIO(b""), "text/csv")},
        )
        # Either 400 (empty file) or 422 (invalid). Auth gate passed.
        assert r.status_code in (400, 422)


# ══ PATCH /uploads/batches/{id} ════════════════════════════════════════════

class TestPatchBatchStatus:
    def test_cancelled_happy_path_achat(self, auth_owner, db: Session) -> None:
        from models import ImportBatch
        client, _, pharmacy = auth_owner
        b = ImportBatch(
            pharmacy_id=pharmacy.id, file_type="achat", filename="x.csv",
            rows_inserted=5, rows_skipped=0, status="in_progress",
        )
        db.add(b)
        db.commit()
        db.refresh(b)
        r = client.patch(f"/v1/uploads/batches/{b.id}", json={"status": "cancelled"})
        assert r.status_code == 200
        db.refresh(b)
        assert b.status == "cancelled"
        assert b.rows_inserted == 0     # reset on cancel

    def test_error_status_carries_message(self, auth_owner, db: Session) -> None:
        from models import ImportBatch
        client, _, pharmacy = auth_owner
        b = ImportBatch(
            pharmacy_id=pharmacy.id, file_type="vente", filename="x.csv",
            rows_inserted=1, rows_skipped=0, status="in_progress",
        )
        db.add(b)
        db.commit()
        db.refresh(b)
        r = client.patch(f"/v1/uploads/batches/{b.id}", json={
            "status": "error", "error_message": "oops",
        })
        assert r.status_code == 200
        db.refresh(b)
        assert b.status == "error"
        assert b.error_message == "oops"

    def test_invalid_status_400(self, auth_owner, db: Session) -> None:
        from models import ImportBatch
        client, _, pharmacy = auth_owner
        b = ImportBatch(
            pharmacy_id=pharmacy.id, file_type="achat", filename="x.csv",
            rows_inserted=1, rows_skipped=0, status="success",
        )
        db.add(b)
        db.commit()
        db.refresh(b)
        r = client.patch(f"/v1/uploads/batches/{b.id}", json={"status": "bogus"})
        assert r.status_code == 400

    def test_not_found(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.patch("/v1/uploads/batches/999999", json={"status": "cancelled"})
        assert r.status_code == 404

    def test_cross_pharmacy_403(self, auth_owner, make_pharmacy, db: Session) -> None:
        from models import ImportBatch
        client, _, _ = auth_owner
        other = make_pharmacy(name="OtherUp")
        b = ImportBatch(
            pharmacy_id=other.id, file_type="achat", filename="x.csv",
            rows_inserted=1, rows_skipped=0, status="success",
        )
        db.add(b)
        db.commit()
        db.refresh(b)
        r = client.patch(f"/v1/uploads/batches/{b.id}", json={"status": "cancelled"})
        assert r.status_code == 403

    def test_unauthenticated(self, client: TestClient) -> None:
        r = client.patch("/v1/uploads/batches/1", json={"status": "cancelled"})
        assert r.status_code == 401
