"""Tests for /v1/stats* — the owner-side analytics endpoints.

Feature-gated as follows:
  /stats                   → feature="rapports"
  /stats/margin-alerts     → feature="alertes"
  /stats/stock-summary     → feature="stock"
  /stats/stock-abcd        → feature="stock"
  /stats/peremptions       → feature="stock"
  /stats/analyse-marge     → feature="analyse"
  /stats/analyse-liste     → feature="analyse"
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from stats_queries import _strip_pct


# Featureless owner — drop all features so the gate fires.
def _strip(set_pharmacy_features, p):
    set_pharmacy_features(p.id, ())


class TestCategoryLabelMerge:
    """`_strip_pct` collapses every Sobrus suffix variant of a category into one
    canonical label so the report donut / analyse show a single bucket."""

    def test_margin_pct_suffix_stripped(self) -> None:
        assert _strip_pct("Médicament (33.930%)") == "Médicament"
        assert _strip_pct("Médicament (30.000%)") == "Médicament"
        assert _strip_pct("Parapharmacie (7.5%)") == "Parapharmacie"

    def test_bare_code_suffix_stripped(self) -> None:
        # (300)/(400) carry no '%' — these used to leak as separate categories.
        assert _strip_pct("Médicament (300)") == "Médicament"
        assert _strip_pct("Médicament (400)") == "Médicament"

    def test_all_variants_merge_to_one(self) -> None:
        variants = ["Médicament (33.930%)", "Médicament (30.000%)",
                    "Médicament (29.747%)", "Médicament (300)", "Médicament (400)"]
        assert {_strip_pct(v) for v in variants} == {"Médicament"}

    def test_plain_category_untouched(self) -> None:
        assert _strip_pct("Complément") == "Complément"
        assert _strip_pct(None) == ""


class TestGetStats:
    def test_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/stats")
        assert r.status_code == 200
        body = r.json()
        assert "kpis" in body and "marge" in body and "tva" in body

    def test_unauthenticated(self, client: TestClient) -> None:
        r = client.get("/v1/stats")
        assert r.status_code == 401

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/stats")
        assert r.status_code == 403

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        _strip(set_pharmacy_features, p)
        r = client.get("/v1/stats")
        assert r.status_code == 403


class TestMarginAlerts:
    def test_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/stats/margin-alerts")
        assert r.status_code == 200

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/stats/margin-alerts")
        assert r.status_code == 403

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        _strip(set_pharmacy_features, p)
        r = client.get("/v1/stats/margin-alerts")
        assert r.status_code == 403


class TestStockSummary:
    def test_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/stats/stock-summary")
        assert r.status_code == 200

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/stats/stock-summary")
        assert r.status_code == 403


class TestStockAbcd:
    def test_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/stats/stock-abcd")
        assert r.status_code == 200

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/stats/stock-abcd")
        assert r.status_code == 403

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        _strip(set_pharmacy_features, p)
        r = client.get("/v1/stats/stock-abcd")
        assert r.status_code == 403


class TestPeremptions:
    def test_empty_returns_4_buckets(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/stats/peremptions")
        assert r.status_code == 200
        body = r.json()
        # 4 mutually-exclusive buckets including the data-quality no_date one
        assert set(body.keys()) == {"expired", "very_close", "close", "no_date"}
        for k in body:
            assert body[k]["count"] == 0
            assert body[k]["products"] == []

    def test_classifies_rows_into_4_buckets(
        self, auth_owner, db,
    ) -> None:
        """Insert stock rows spread across the 3 date bands + 1 NULL expiry +
        1 out-of-range (≥ 12 months). NULL rows land in `no_date`; ≥ 360d still
        skipped. Boundaries port the old apcm-pharma behavior: very_close
        < today+180d, close < today+360d."""
        from datetime import date, timedelta

        from models import Medicament, PharmacyStock

        client, _, pharmacy = auth_owner
        today = date.today()

        def _mk(pid: str, days_from_today: int | None) -> None:
            med = Medicament(pid=pid, product=f"P{pid}", category="Medicament",
                             tva="TVA (20.00%)", pph=5.0, ppv=10.0)
            db.add(med)
            db.flush()
            expiry = None if days_from_today is None else today + timedelta(days=days_from_today)
            db.add(PharmacyStock(
                pharmacy_id=pharmacy.id, medicament_id=med.id,
                current_stock=10, expiry_date=expiry,
            ))

        _mk("EXP",  -3)    # expired (3 days past)
        _mk("VCA",   0)    # very_close (today is the boundary, inclusive)
        _mk("VCB", 179)    # very_close (last day before the 6-month boundary)
        _mk("CLO", 180)    # close (first day of the 6→12-month band)
        _mk("CLB", 359)    # close (last day before the 12-month boundary)
        _mk("FAR", 360)    # ≥ 12 months → skipped entirely
        _mk("NUL", None)   # NULL expiry → lands in no_date
        db.commit()

        body = client.get("/v1/stats/peremptions").json()
        assert body["expired"]["count"] == 1
        assert body["very_close"]["count"] == 2
        assert body["close"]["count"] == 2
        assert body["no_date"]["count"] == 1
        # FAR (≥ 12 months) must NOT leak into any bucket; everyone else does.
        total = sum(b["count"] for b in body.values())
        assert total == 6

    def test_excludes_zero_stock(self, auth_owner, db) -> None:
        from datetime import date, timedelta

        from models import Medicament, PharmacyStock

        client, _, pharmacy = auth_owner
        med = Medicament(pid="Z1", product="ZeroStock", category="Medicament",
                         tva="TVA (20.00%)", pph=5.0, ppv=10.0)
        db.add(med)
        db.flush()
        db.add(PharmacyStock(
            pharmacy_id=pharmacy.id, medicament_id=med.id,
            current_stock=0, expiry_date=date.today() + timedelta(days=3),
        ))
        db.commit()

        body = client.get("/v1/stats/peremptions").json()
        assert body["very_close"]["count"] == 0

    def test_unauthenticated(self, client) -> None:
        r = client.get("/v1/stats/peremptions")
        assert r.status_code == 401

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/stats/peremptions")
        assert r.status_code == 403

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        set_pharmacy_features(p.id, ())
        r = client.get("/v1/stats/peremptions")
        assert r.status_code == 403


class TestAnalyseMarge:
    def test_happy_path_produit(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/stats/analyse-marge?mode=produit")
        assert r.status_code == 200
        assert r.json()["mode"] == "produit"

    def test_mode_required(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/stats/analyse-marge")
        assert r.status_code == 422

    def test_invalid_mode_422(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/stats/analyse-marge?mode=bogus")
        assert r.status_code == 422

    def test_liste_mode_routed_to_post(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/stats/analyse-marge?mode=liste")
        assert r.status_code == 400
        assert "POST" in r.json()["detail"]

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/stats/analyse-marge?mode=produit")
        assert r.status_code == 403

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        _strip(set_pharmacy_features, p)
        r = client.get("/v1/stats/analyse-marge?mode=produit")
        assert r.status_code == 403


class TestAnalyseListe:
    def test_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.post("/v1/stats/analyse-liste", json={
            "items": [{"name": "X", "pid": "P00001"}],
            "date_from": None, "date_to": None, "category_type": "all",
        })
        assert r.status_code == 200
        assert r.json()["mode"] == "liste"

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.post("/v1/stats/analyse-liste", json={"items": []})
        assert r.status_code == 403

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        _strip(set_pharmacy_features, p)
        r = client.post("/v1/stats/analyse-liste", json={"items": []})
        assert r.status_code == 403
