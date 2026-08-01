"""Tests for /v1/supplier-exclusions/* — owner-managed supplier exclusions.

Excluding a supplier NAME is non-destructive and reversible; every Achat from
that supplier drops out of the achats aggregates via achat_supplier_filter()
(accent/case-insensitive). Sales are never touched (the Sobrus ventes export
carries no supplier)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


@pytest.fixture
def med(db: Session):
    from models import Medicament
    counter = {"i": 0}

    def _make(name: str | None = None):
        counter["i"] += 1
        m = Medicament(pid=f"SUX{counter['i']:05d}",
                       product=name or f"SUX-Med{counter['i']}",
                       ppv=100.0, tva="TVA (20.00%)")
        db.add(m); db.commit(); db.refresh(m)
        return m
    return _make


@pytest.fixture
def achat(db: Session, auth_owner, med):
    """Insert one Achat line for a given supplier in the owner's pharmacy."""
    from models import Achat
    _client, _owner, pharmacy = auth_owner

    def _make(supplier: str, *, delivery_ref: str | None = None, product: str | None = None,
              qty: float = 2.0, unit_price: float = 30.0, date: str = "2026-03-01"):
        m = med(product)
        a = Achat(pharmacy_id=pharmacy.id, medicament_id=m.id, delivery_ref=delivery_ref,
                  delivery_date=date, supplier=supplier, quantity=qty,
                  unit_price=unit_price, total=qty * unit_price)
        db.add(a); db.commit(); db.refresh(a)
        return a
    return _make


class TestSupplierExclusionCrud:
    def test_list_empty(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/supplier-exclusions/")
        assert r.status_code == 200
        assert r.json() == []

    def test_unauthenticated(self, client: TestClient) -> None:
        assert client.get("/v1/supplier-exclusions/").status_code == 401

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        assert client.get("/v1/supplier-exclusions/").status_code == 403

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        set_pharmacy_features(p.id, ())
        assert client.get("/v1/supplier-exclusions/").status_code == 403

    def test_exclude_then_list_then_reintegrate(self, auth_owner, achat) -> None:
        client, _, _ = auth_owner
        achat("CERP", product="DOLIPRANE", date="2026-02-10")
        achat("CERP", product="EFFERALGAN")

        r = client.post("/v1/supplier-exclusions/", json={"supplier": "CERP", "notes": "achat exceptionnel"})
        assert r.status_code == 201
        body = r.json()
        assert body["excluded"] == 1 and body["already_excluded"] == 0
        assert body["item"]["nb_lines"] == 2
        assert body["item"]["nb_products"] == 2
        assert body["item"]["notes"] == "achat exceptionnel"

        r = client.get("/v1/supplier-exclusions/")
        assert r.status_code == 200 and len(r.json()) == 1
        assert r.json()[0]["supplier"] == "CERP"

        # idempotent re-exclude
        r = client.post("/v1/supplier-exclusions/", json={"supplier": "CERP"})
        assert r.status_code == 201 and r.json()["already_excluded"] == 1

        # reintegrate
        r = client.post("/v1/supplier-exclusions/reintegrate", json={"suppliers": ["CERP"]})
        assert r.status_code == 200 and r.json()["reintegrated"] == 1
        assert client.get("/v1/supplier-exclusions/").json() == []

    def test_exclude_bogus_supplier_404(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.post("/v1/supplier-exclusions/", json={"supplier": "NOPE"})
        assert r.status_code == 404

    def test_reintegrate_unknown_is_noop(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.post("/v1/supplier-exclusions/reintegrate", json={"suppliers": ["X", "Y"]})
        assert r.status_code == 200
        assert r.json() == {"reintegrated": 0, "not_excluded": 2, "suppliers": ["X", "Y"]}


class TestSupplierSearch:
    def test_search_by_name_substring(self, auth_owner, achat) -> None:
        client, _, _ = auth_owner
        achat("GROSSISTE CDP", product="AMOXICILLINE")
        r = client.get("/v1/supplier-exclusions/search?q=cdp")   # accent/case-insensitive
        assert r.status_code == 200
        names = [s["supplier"] for s in r.json()]
        assert "GROSSISTE CDP" in names

    def test_search_wildcard_suffix(self, auth_owner, achat) -> None:
        client, _, _ = auth_owner
        achat("LABO SANOFI", product="X")
        r = client.get("/v1/supplier-exclusions/search?q=*sanofi")
        assert r.status_code == 200
        assert "LABO SANOFI" in [s["supplier"] for s in r.json()]

    def test_search_flags_already_excluded(self, auth_owner, achat) -> None:
        client, _, _ = auth_owner
        achat("COOPER", product="SPASFON")
        client.post("/v1/supplier-exclusions/", json={"supplier": "COOPER"})
        r = client.get("/v1/supplier-exclusions/search?q=cooper")
        hit = [s for s in r.json() if s["supplier"] == "COOPER"]
        assert hit and hit[0]["already_excluded"] is True


class TestSupplierExclusionEffect:
    """Excluding a supplier must remove its Achats from the aggregates."""

    def test_excluded_supplier_drops_from_achats_list_in_comptabilite_view(self, auth_owner, achat) -> None:
        """USER DECISION 2026-08-01: excluded suppliers drop from the Achats ledger
        ONLY in the comptabilite view (include_non_declared=false)."""
        client, _, _ = auth_owner
        achat("KEEP-SUP", product="V", qty=1, unit_price=50, delivery_ref="R1")
        achat("DROP-SUP", product="H", qty=1, unit_price=200, delivery_ref="R2")

        r = client.get("/v1/achats?limit=100").json()
        suppliers = {row["supplier"] for row in r["data"]}
        assert {"KEEP-SUP", "DROP-SUP"} <= suppliers
        total_before = r["summary"]["grand_total"]

        client.post("/v1/supplier-exclusions/", json={"supplier": "DROP-SUP"})

        # Default view keeps the excluded supplier visible
        r = client.get("/v1/achats?limit=100").json()
        suppliers = {row["supplier"] for row in r["data"]}
        assert {"KEEP-SUP", "DROP-SUP"} <= suppliers
        assert round(r["summary"]["grand_total"], 2) == total_before

        # Comptabilite view drops it
        r = client.get("/v1/achats?limit=100&include_non_declared=false").json()
        suppliers = {row["supplier"] for row in r["data"]}
        assert "DROP-SUP" not in suppliers and "KEEP-SUP" in suppliers
        assert round(total_before - r["summary"]["grand_total"], 2) == 200.0

    def test_exclusion_is_accent_case_insensitive(self, auth_owner, achat) -> None:
        """Excluding 'grossiste cdp' must also drop rows stored as 'GROSSISTE CDP'
        in the comptabilite view."""
        client, _, _ = auth_owner
        achat("GROSSISTE CDP", product="A", qty=1, unit_price=100, delivery_ref="R1")

        client.post("/v1/supplier-exclusions/", json={"supplier": "GROSSISTE CDP"})

        # Default keeps it
        r = client.get("/v1/achats?limit=100").json()
        assert "GROSSISTE CDP" in {row["supplier"] for row in r["data"]}

        # Comptabilite drops it
        r = client.get("/v1/achats?limit=100&include_non_declared=false").json()
        assert "GROSSISTE CDP" not in {row["supplier"] for row in r["data"]}
