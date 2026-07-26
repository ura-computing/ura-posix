"""Tests for /v1/bl-exclusions/* — owner-managed BL (delivery-note) exclusions (PG-007).

Excluding a delivery_ref is non-destructive and reversible; every Achat with that
ref drops out of the achats aggregates via achat_bl_filter(). Sales are never
touched (the Sobrus ventes export has no delivery reference)."""
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
        m = Medicament(pid=f"BLX{counter['i']:05d}",
                       product=name or f"BLX-Med{counter['i']}",
                       ppv=100.0, tva="TVA (20.00%)")
        db.add(m); db.commit(); db.refresh(m)
        return m
    return _make


@pytest.fixture
def achat(db: Session, auth_owner, med):
    """Insert one Achat line on a given BL for the owner's pharmacy."""
    from models import Achat
    _client, _owner, pharmacy = auth_owner

    def _make(delivery_ref: str, *, product: str | None = None, qty: float = 2.0,
              unit_price: float = 30.0, supplier: str = "Grossiste Test",
              date: str = "2026-03-01") -> Achat:
        m = med(product)
        a = Achat(pharmacy_id=pharmacy.id, medicament_id=m.id, delivery_ref=delivery_ref,
                  delivery_date=date, supplier=supplier, quantity=qty,
                  unit_price=unit_price, total=qty * unit_price)
        db.add(a); db.commit(); db.refresh(a)
        return a
    return _make


class TestBlExclusionCrud:
    def test_list_empty(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/bl-exclusions/")
        assert r.status_code == 200
        assert r.json() == []

    def test_unauthenticated(self, client: TestClient) -> None:
        assert client.get("/v1/bl-exclusions/").status_code == 401

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        assert client.get("/v1/bl-exclusions/").status_code == 403

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        set_pharmacy_features(p.id, ())
        assert client.get("/v1/bl-exclusions/").status_code == 403

    def test_exclude_then_list_then_reintegrate(self, auth_owner, achat) -> None:
        client, _, _ = auth_owner
        achat("BL-AAA", product="DOLIPRANE",  supplier="CERP", date="2026-02-10")
        achat("BL-AAA", product="EFFERALGAN", supplier="CERP")   # same BL → same supplier

        # exclude
        r = client.post("/v1/bl-exclusions/", json={"delivery_ref": "BL-AAA", "notes": "achat exceptionnel"})
        assert r.status_code == 201
        body = r.json()
        assert body["excluded"] == 1 and body["already_excluded"] == 0
        assert body["item"]["nb_lines"] == 2
        assert body["item"]["supplier"] == "CERP"
        assert body["item"]["notes"] == "achat exceptionnel"

        # list
        r = client.get("/v1/bl-exclusions/")
        assert r.status_code == 200 and len(r.json()) == 1
        assert r.json()[0]["delivery_ref"] == "BL-AAA"

        # idempotent re-exclude
        r = client.post("/v1/bl-exclusions/", json={"delivery_ref": "BL-AAA"})
        assert r.status_code == 201 and r.json()["already_excluded"] == 1

        # reintegrate
        r = client.post("/v1/bl-exclusions/reintegrate", json={"delivery_refs": ["BL-AAA"]})
        assert r.status_code == 200 and r.json()["reintegrated"] == 1
        assert client.get("/v1/bl-exclusions/").json() == []

    def test_exclude_bogus_ref_404(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.post("/v1/bl-exclusions/", json={"delivery_ref": "NOPE"})
        assert r.status_code == 404

    def test_reintegrate_unknown_is_noop(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.post("/v1/bl-exclusions/reintegrate", json={"delivery_refs": ["X", "Y"]})
        assert r.status_code == 200
        assert r.json() == {"reintegrated": 0, "not_excluded": 2, "delivery_refs": ["X", "Y"]}


class TestBlSearchAndDetail:
    def test_search_by_reference_substring(self, auth_owner, achat) -> None:
        client, _, _ = auth_owner
        achat("LVC2606CAS00033", product="AMOXICILLINE")
        r = client.get("/v1/bl-exclusions/search?q=LVC2606")
        assert r.status_code == 200
        refs = [b["delivery_ref"] for b in r.json()]
        assert "LVC2606CAS00033" in refs

    def test_search_by_product_name(self, auth_owner, achat) -> None:
        client, _, _ = auth_owner
        achat("BL-XYZ", product="RINOMICINE ST B10 SACHETS")
        r = client.get("/v1/bl-exclusions/search?q=rinomicine")   # accent/case-insensitive
        assert r.status_code == 200
        hit = [b for b in r.json() if b["delivery_ref"] == "BL-XYZ"]
        assert hit, "BL containing the searched product should be found"
        # the row must surface WHICH product matched (user recognises the BL by it)
        assert "RINOMICINE ST B10 SACHETS" in hit[0]["matched_products"]

    def test_search_by_product_wildcard_per_word(self, auth_owner, achat) -> None:
        """`rinom*ne` must match the WORD 'RINOMICINE' inside a multi-word product
        name (the SQL `~*` per-word regex), even though the full name ends 'SACHETS'."""
        client, _, _ = auth_owner
        achat("BL-WILD", product="RINOMICINE ST B10 SACHETS")
        for q in ("rinom*ne", "rinom*", "*cine"):
            r = client.get(f"/v1/bl-exclusions/search?q={q}")
            assert r.status_code == 200
            assert "BL-WILD" in [b["delivery_ref"] for b in r.json()], f"query {q!r} should match"
        # a wildcard must NOT span across words
        r = client.get("/v1/bl-exclusions/search?q=rinom*sachets")
        assert "BL-WILD" not in [b["delivery_ref"] for b in r.json()]

    def test_search_flags_already_excluded(self, auth_owner, achat) -> None:
        client, _, _ = auth_owner
        achat("BL-DUP", product="SPASFON")
        client.post("/v1/bl-exclusions/", json={"delivery_ref": "BL-DUP"})
        r = client.get("/v1/bl-exclusions/search?q=BL-DUP")
        hit = [b for b in r.json() if b["delivery_ref"] == "BL-DUP"]
        assert hit and hit[0]["already_excluded"] is True

    def test_detail_lists_products(self, auth_owner, achat) -> None:
        client, _, _ = auth_owner
        achat("BL-DET", product="PARACETAMOL", qty=3, unit_price=10, supplier="COOPER", date="2026-04-02")
        achat("BL-DET", product="IBUPROFENE",  qty=1, unit_price=20, supplier="COOPER")
        r = client.get("/v1/bl-exclusions/detail?delivery_ref=BL-DET")
        assert r.status_code == 200
        d = r.json()
        assert d["nb_lines"] == 2
        assert d["supplier"] == "COOPER"
        assert round(d["total"], 2) == 50.0
        products = {ln["product"] for ln in d["lines"]}
        assert products == {"PARACETAMOL", "IBUPROFENE"}

    def test_detail_unknown_404(self, auth_owner) -> None:
        client, _, _ = auth_owner
        assert client.get("/v1/bl-exclusions/detail?delivery_ref=NOPE").status_code == 404


class TestBlExclusionEffect:
    """Excluding a BL must remove its Achats from the aggregates (achat_bl_filter)."""

    def test_excluded_bl_drops_from_supplier_summary(self, auth_owner, achat) -> None:
        client, _, _ = auth_owner
        achat("BL-KEEP", product="A", qty=1, unit_price=100, supplier="Grossiste Test")
        achat("BL-DROP", product="B", qty=1, unit_price=999, supplier="Grossiste Test")

        before = client.get("/v1/achats/supplier-summary").json()
        total_before = before["grossiste"]["total_mad"] + before["direct_labo"]["total_mad"]

        client.post("/v1/bl-exclusions/", json={"delivery_ref": "BL-DROP"})

        after = client.get("/v1/achats/supplier-summary").json()
        total_after = after["grossiste"]["total_mad"] + after["direct_labo"]["total_mad"]

        assert round(total_before - total_after, 2) == 999.0   # exactly the excluded BL

    def test_excluded_bl_drops_from_stock_avg_pu(self, auth_owner, db) -> None:
        """PG-007 parity gap: the /stock PU moyen must ignore excluded-BL lines.
        Two BLs for the same product (PU 10 and 100) → avg 55; excluding the
        100-BL leaves avg 10."""
        from models import Achat, Medicament, PharmacyStock
        from stock_queries import compute_stock_abcd
        client, _, pharmacy = auth_owner

        m = Medicament(pid="BLSTK1", product="STOCK-MED", ppv=200.0, tva="TVA (20.00%)")
        db.add(m); db.commit(); db.refresh(m)
        for ref, pu in (("BL-CHEAP", 10.0), ("BL-PRICEY", 100.0)):
            db.add(Achat(pharmacy_id=pharmacy.id, medicament_id=m.id, delivery_ref=ref,
                         delivery_date="2026-02-01", supplier="Gr", quantity=1.0,
                         unit_price=pu, total=pu))
        db.add(PharmacyStock(pharmacy_id=pharmacy.id, medicament_id=m.id, current_stock=5))
        db.commit()

        def pu_of(product_id: int) -> float | None:
            data = compute_stock_abcd(db, pharmacy.id, None, None)
            row = next((p for p in data["products"] if p.get("id") == product_id
                        or p.get("medicament_id") == product_id
                        or p.get("product") == "STOCK-MED"), None)
            return None if row is None else row.get("avg_pu")

        assert pu_of(m.id) == pytest.approx(55.0)          # (10 + 100) / 2
        client.post("/v1/bl-exclusions/", json={"delivery_ref": "BL-PRICEY"})
        assert pu_of(m.id) == pytest.approx(10.0)          # pricey BL gone

    def test_excluded_bl_hidden_from_achats_list(self, auth_owner, achat) -> None:
        """PG-007: excluded BLs disappear from the Achats ledger — rows AND total."""
        client, _, _ = auth_owner
        achat("BL-VISIBLE", product="V", qty=1, unit_price=50)
        achat("BL-HIDDEN",  product="H", qty=1, unit_price=200)

        r = client.get("/v1/achats?limit=100").json()
        refs = {row["delivery_ref"] for row in r["data"]}
        assert {"BL-VISIBLE", "BL-HIDDEN"} <= refs
        total_before = r["summary"]["grand_total"]

        client.post("/v1/bl-exclusions/", json={"delivery_ref": "BL-HIDDEN"})

        r = client.get("/v1/achats?limit=100").json()
        refs = {row["delivery_ref"] for row in r["data"]}
        assert "BL-HIDDEN" not in refs and "BL-VISIBLE" in refs   # row gone
        assert round(total_before - r["summary"]["grand_total"], 2) == 200.0   # total dropped
