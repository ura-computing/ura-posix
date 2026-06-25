"""Tests for /v1/achats* + /v1/ventes* — the data-ledger surface.

Every endpoint is feature-gated:
  /achats* → feature="achats"
  /ventes* → feature="ventes"
Plus require_pharmacy_owner — so admin always gets 403.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


# ── helpers ────────────────────────────────────────────────────────────────

@pytest.fixture
def medicament(db: Session):
    """Insert a Medicament so transactions can reference one."""
    from models import Medicament
    counter = {"i": 0}

    def _make(pid: str | None = None, category: str = "Medicament (30.00%)", tva: str = "TVA (20.00%)") -> Medicament:
        counter["i"] += 1
        med = Medicament(
            pid=pid or f"PID{counter['i']:05d}",
            product=f"Med{counter['i']}",
            category=category,
            tva=tva,
            pph=10.0, ppv=15.0,
        )
        db.add(med)
        db.commit()
        db.refresh(med)
        return med

    return _make


@pytest.fixture
def achat(db: Session, auth_owner, medicament):
    """Insert an Achat row tied to the owner's pharmacy."""
    from models import Achat
    _client, _owner, pharmacy = auth_owner

    def _make(supplier: str = "Test Supplier", total: float = 100.0, **extra) -> Achat:
        med = extra.pop("medicament", None) or medicament()
        a = Achat(
            pharmacy_id=pharmacy.id,
            medicament_id=med.id,
            delivery_ref=extra.pop("delivery_ref", f"BL-{med.id}"),
            delivery_date="2026-01-15",
            supplier=supplier,
            quantity=2.0,
            unit_price=total / 2,
            total=total,
        )
        db.add(a)
        db.commit()
        db.refresh(a)
        return a

    return _make


@pytest.fixture
def vente(db: Session, auth_owner, medicament):
    """Insert a Vente row tied to the owner's pharmacy."""
    from models import Vente
    _client, _owner, pharmacy = auth_owner

    def _make(client: str = "Comptoir", total: float = 50.0, **extra):
        med = extra.pop("medicament", None) or medicament()
        v = Vente(
            pharmacy_id=pharmacy.id,
            medicament_id=med.id,
            transaction_ref=extra.pop("transaction_ref", f"V-{med.id}"),
            date="2026-01-20",
            client=client,
            quantity=1.0,
            unit_price=total,
            total=total,
        )
        db.add(v)
        db.commit()
        db.refresh(v)
        return v

    return _make


# ══ /achats ════════════════════════════════════════════════════════════════

class TestListAchats:
    def test_empty_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/achats")
        assert r.status_code == 200
        body = r.json()
        assert body["data"] == []
        assert body["summary"]["rows_total"] == 0

    def test_with_rows(self, auth_owner, achat) -> None:
        client, _, _ = auth_owner
        achat(supplier="Grossiste A", total=200.0)
        achat(supplier="Grossiste B", total=50.0)
        r = client.get("/v1/achats")
        assert r.status_code == 200
        body = r.json()
        assert body["summary"]["rows_total"] == 2
        assert body["summary"]["grand_total"] == 250.0

    def test_excludes_other_pharmacy(self, auth_owner, achat, make_pharmacy, db: Session) -> None:
        from models import Achat
        client, _, _ = auth_owner
        # Insert an Achat for ANOTHER pharmacy — must not show up.
        other = make_pharmacy(name="OtherForeign")
        db.add(Achat(pharmacy_id=other.id, total=999.0))
        db.commit()
        achat(total=50.0)
        r = client.get("/v1/achats")
        body = r.json()
        assert body["summary"]["rows_total"] == 1
        assert body["summary"]["grand_total"] == 50.0

    def test_unauthenticated(self, client: TestClient) -> None:
        r = client.get("/v1/achats")
        assert r.status_code == 401

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/achats")
        assert r.status_code == 403

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        set_pharmacy_features(p.id, ())   # revoke all features
        r = client.get("/v1/achats")
        assert r.status_code == 403


class TestAchatCategories:
    def test_happy_path(self, auth_owner, achat) -> None:
        client, _, _ = auth_owner
        achat()
        r = client.get("/v1/achats/categories")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/achats/categories")
        assert r.status_code == 403

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        set_pharmacy_features(p.id, ())
        r = client.get("/v1/achats/categories")
        assert r.status_code == 403


class TestAchatTvaRates:
    def test_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/achats/tva-rates")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/achats/tva-rates")
        assert r.status_code == 403


class TestAchatSuggestions:
    def test_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/achats/suggestions?q=test")
        assert r.status_code == 200

    def test_missing_q_returns_default(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/achats/suggestions")
        # Most search-suggest endpoints accept empty q; expect 200 OR 422.
        assert r.status_code in (200, 422)

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/achats/suggestions?q=xx")
        assert r.status_code == 403


class TestAchatSupplierSummary:
    def test_happy_path(self, auth_owner, achat) -> None:
        client, _, _ = auth_owner
        achat(supplier="Sup1", total=100.0)
        achat(supplier="Sup1", total=50.0)
        achat(supplier="Sup2", total=200.0)
        r = client.get("/v1/achats/supplier-summary")
        assert r.status_code == 200

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/achats/supplier-summary")
        assert r.status_code == 403

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        set_pharmacy_features(p.id, ())
        r = client.get("/v1/achats/supplier-summary")
        assert r.status_code == 403


# ══ /ventes ════════════════════════════════════════════════════════════════

class TestListVentes:
    def test_empty_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/ventes")
        assert r.status_code == 200
        body = r.json()
        assert body["data"] == []

    def test_with_rows(self, auth_owner, vente) -> None:
        client, _, _ = auth_owner
        vente(client="C1", total=30.0)
        vente(client="C2", total=20.0)
        r = client.get("/v1/ventes")
        assert r.status_code == 200
        assert r.json()["summary"]["rows_total"] == 2

    def test_excludes_other_pharmacy(self, auth_owner, vente, make_pharmacy, db: Session) -> None:
        from models import Vente
        client, _, _ = auth_owner
        other = make_pharmacy(name="OtherForeignV")
        db.add(Vente(pharmacy_id=other.id, total=999.0))
        db.commit()
        vente(total=10.0)
        r = client.get("/v1/ventes")
        assert r.json()["summary"]["rows_total"] == 1

    def test_unauthenticated(self, client: TestClient) -> None:
        r = client.get("/v1/ventes")
        assert r.status_code == 401

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/ventes")
        assert r.status_code == 403

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        set_pharmacy_features(p.id, ())
        r = client.get("/v1/ventes")
        assert r.status_code == 403


class TestVenteCategories:
    def test_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/ventes/categories")
        assert r.status_code == 200

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/ventes/categories")
        assert r.status_code == 403


class TestVenteTvaRates:
    def test_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/ventes/tva-rates")
        assert r.status_code == 200

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/ventes/tva-rates")
        assert r.status_code == 403


class TestVenteSuggestions:
    def test_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/ventes/suggestions?q=test")
        assert r.status_code == 200

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/ventes/suggestions?q=xx")
        assert r.status_code == 403


class TestVenteSurveillanceCounts:
    def test_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/ventes/surveillance-counts")
        assert r.status_code == 200

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/ventes/surveillance-counts")
        assert r.status_code == 403

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        set_pharmacy_features(p.id, ())
        r = client.get("/v1/ventes/surveillance-counts")
        assert r.status_code == 403
