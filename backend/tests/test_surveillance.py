"""Tests for ventes surveillance endpoints."""

import pytest
from tests.factories import make_achat, make_medicament, make_vente


@pytest.fixture()
def surveillance_data(db, test_owner):
    pharmacy_id = test_owner["pharmacy"].id

    med1 = make_medicament(db, pid="SURV-001", product="Product Normal", ppv=100.0, pph=80.0)
    med2 = make_medicament(db, pid="SURV-002", product="Product Negative Margin", ppv=50.0, pph=40.0)
    med3 = make_medicament(db, pid="SURV-003", product="Product Low Margin", ppv=100.0, pph=95.0)

    # Achats (set purchase prices)
    make_achat(db, med1, pharmacy_id, quantity=10, unit_price=80.0, delivery_ref="BL-S1")
    make_achat(db, med2, pharmacy_id, quantity=10, unit_price=60.0, delivery_ref="BL-S2")  # PU > PPV = negative margin
    make_achat(db, med3, pharmacy_id, quantity=10, unit_price=95.0, delivery_ref="BL-S3")  # 5% margin = low

    # Ventes
    make_vente(db, med1, pharmacy_id, quantity=5, unit_price=100.0, transaction_ref="FAC-S1", discount=0)
    make_vente(db, med1, pharmacy_id, quantity=2, unit_price=100.0, transaction_ref="FAC-S2", discount=25.0)  # remise
    make_vente(db, med2, pharmacy_id, quantity=3, unit_price=50.0, transaction_ref="FAC-S3", discount=0)  # neg margin
    make_vente(db, med3, pharmacy_id, quantity=4, unit_price=100.0, transaction_ref="FAC-S4", discount=0)  # low margin

    return {"pharmacy_id": pharmacy_id}


class TestSurveillanceCounts:
    def test_returns_counts(self, client, test_owner, surveillance_data):
        res = client.get("/ventes/surveillance-counts", headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        assert "remises" in data
        assert "marge_negative" in data
        assert "marge_low" in data
        assert "all" in data

    def test_remises_count(self, client, test_owner, surveillance_data):
        res = client.get("/ventes/surveillance-counts", headers=test_owner["headers"])
        data = res.json()
        assert data["remises"] == 1  # Only FAC-S2 has discount > 0

    def test_marge_negative_count(self, client, test_owner, surveillance_data):
        res = client.get("/ventes/surveillance-counts", headers=test_owner["headers"])
        data = res.json()
        assert data["marge_negative"] >= 1  # med2 has PU(60) > PPV(50)

    def test_requires_auth(self, client):
        res = client.get("/ventes/surveillance-counts")
        assert res.status_code in (401, 403)


class TestSurveillanceFilter:
    def test_surveillance_remises(self, client, test_owner, surveillance_data):
        res = client.get("/ventes?page=1&limit=20&surveillance=remises", headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        # All returned rows should have discount > 0
        for row in data["data"]:
            assert (row.get("discount") or 0) > 0

    def test_surveillance_marge_negative(self, client, test_owner, surveillance_data):
        res = client.get("/ventes?page=1&limit=20&surveillance=marge_negative", headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        assert len(data["data"]) >= 1  # At least med2

    def test_surveillance_none_returns_all(self, client, test_owner, surveillance_data):
        res = client.get("/ventes?page=1&limit=20", headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        assert data["pagination"]["total"] == 4  # All 4 ventes

    def test_pagination_with_surveillance(self, client, test_owner, surveillance_data):
        res = client.get("/ventes?page=1&limit=1&surveillance=remises", headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        assert len(data["data"]) <= 1
