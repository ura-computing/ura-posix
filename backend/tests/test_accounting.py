"""Tests for /v1/accounting/payments — owner ledger upsert + delete."""
from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def _payment_body(month: str = "2026-06", method: str = "especes", count: int = 5,
                  pharm: float = 100.0, para: float = 50.0) -> dict:
    return {
        "month":               month,
        "method":              method,
        "count":               count,
        "pharmacie_amount":    pharm,
        "parapharmacie_amount": para,
    }


class TestListPayments:
    def test_empty_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/accounting/payments")
        assert r.status_code == 200
        assert r.json() == []

    def test_with_rows(self, auth_owner) -> None:
        client, _, _ = auth_owner
        client.post("/v1/accounting/payments", json=_payment_body(month="2026-06", method="especes"))
        client.post("/v1/accounting/payments", json=_payment_body(month="2026-05", method="tpe"))
        r = client.get("/v1/accounting/payments")
        body = r.json()
        assert len(body) == 2

    def test_month_filter(self, auth_owner) -> None:
        client, _, _ = auth_owner
        client.post("/v1/accounting/payments", json=_payment_body(month="2026-06", method="especes"))
        client.post("/v1/accounting/payments", json=_payment_body(month="2026-05", method="tpe"))
        r = client.get("/v1/accounting/payments?month=2026-06")
        assert all(p["month"] == "2026-06" for p in r.json())

    def test_invalid_month_format_422(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/accounting/payments?month=junk")
        assert r.status_code == 422

    def test_unauthenticated(self, client: TestClient) -> None:
        r = client.get("/v1/accounting/payments")
        assert r.status_code == 401

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/accounting/payments")
        assert r.status_code == 403

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        set_pharmacy_features(p.id, ())
        r = client.get("/v1/accounting/payments")
        assert r.status_code == 403


class TestSavePayment:
    def test_happy_path_insert(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.post("/v1/accounting/payments", json=_payment_body())
        assert r.status_code == 200
        body = r.json()
        assert body["month"] == "2026-06"
        assert body["method"] == "especes"
        assert body["pharmacie_amount"] == 100.0

    def test_upsert_overwrites_existing(self, auth_owner) -> None:
        client, _, _ = auth_owner
        client.post("/v1/accounting/payments", json=_payment_body(pharm=100.0))
        client.post("/v1/accounting/payments", json=_payment_body(pharm=999.0))
        r = client.get("/v1/accounting/payments?month=2026-06")
        body = r.json()
        assert len(body) == 1                    # not duplicated
        assert body[0]["pharmacie_amount"] == 999.0

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.post("/v1/accounting/payments", json=_payment_body())
        assert r.status_code == 403

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        set_pharmacy_features(p.id, ())
        r = client.post("/v1/accounting/payments", json=_payment_body())
        assert r.status_code == 403


class TestDeletePayment:
    def test_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        created = client.post("/v1/accounting/payments", json=_payment_body()).json()
        r = client.delete(f"/v1/accounting/payments/{created['id']}")
        assert r.status_code == 200
        assert r.json() == {"deleted": True}

    def test_not_found(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.delete("/v1/accounting/payments/999999")
        assert r.status_code == 404

    def test_other_pharmacy_404(self, auth_owner, make_user, make_pharmacy, db: Session) -> None:
        # Insert a payment for another pharmacy directly → caller must not be able to delete.
        from models import PaymentEntry
        client, _, _ = auth_owner
        other = make_pharmacy(name="OtherPa")
        entry = PaymentEntry(
            pharmacy_id=other.id, month="2026-06", method="especes",
            count=1, pharmacie_amount=10.0, parapharmacie_amount=0.0,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        r = client.delete(f"/v1/accounting/payments/{entry.id}")
        assert r.status_code == 404

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.delete("/v1/accounting/payments/1")
        assert r.status_code == 403
