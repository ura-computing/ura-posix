"""Tests for data management endpoints (routers/data.py)."""

from models import Pharmacy, User
from tests.factories import make_achat, make_import_batch, make_medicament, make_vente
from utils.auth import hash_password, create_access_token
from utils.constants import Role, Status


# ── Helpers ──────────────────────────────────────────────────────────────────


def _setup_achat_data(db, pharmacy_id, dates=None):
    """Create a medicament and several achats with the given delivery dates."""
    med = make_medicament(db, pid="DATA-ACH-001", product="Amoxicilline 500mg")
    dates = dates or ["2026-01-15", "2026-02-15", "2026-03-15"]
    achats = []
    for i, d in enumerate(dates):
        achats.append(make_achat(
            db, med, pharmacy_id,
            delivery_date=d,
            delivery_ref=f"BL-DATA-{i+1:03d}",
        ))
    return med, achats


def _setup_vente_data(db, pharmacy_id, dates=None):
    """Create a medicament and several ventes with the given dates."""
    med = make_medicament(db, pid="DATA-VEN-001", product="Doliprane 1g")
    dates = dates or ["2026-01-10", "2026-02-10", "2026-03-10"]
    ventes = []
    for i, d in enumerate(dates):
        ventes.append(make_vente(
            db, med, pharmacy_id,
            date=d,
            transaction_ref=f"FAC-DATA-{i+1:03d}",
        ))
    return med, ventes


def _other_user(db):
    """Create a separate pharmacy + owner for isolation tests."""
    pharmacy = Pharmacy(name="Pharmacie Isolee", address="999 Rue Isolee")
    db.add(pharmacy)
    db.flush()
    owner = User(
        email="isolated_owner@test.com",
        name="Isolated Owner",
        password_hash=hash_password("iso123"),
        role=Role.OWNER,
        status=Status.ACTIVE,
        pharmacy_id=pharmacy.id,
    )
    db.add(owner)
    db.flush()
    token = create_access_token({"sub": str(owner.id)})
    return {
        "pharmacy": pharmacy,
        "user": owner,
        "headers": {"Authorization": f"Bearer {token}"},
    }


# ── DELETE /data/achats ──────────────────────────────────────────────────────


class TestClearAchats:
    def test_clear_all_achats(self, client, db, test_owner):
        pharmacy_id = test_owner["pharmacy"].id
        _setup_achat_data(db, pharmacy_id)
        db.commit()

        res = client.delete("/data/achats", headers=test_owner["headers"])
        assert res.status_code == 200
        assert res.json()["deleted"] == 3

    def test_clear_achats_by_date_range(self, client, db, test_owner):
        pharmacy_id = test_owner["pharmacy"].id
        _setup_achat_data(db, pharmacy_id, dates=["2026-01-15", "2026-02-15", "2026-03-15"])
        db.commit()

        res = client.delete(
            "/data/achats",
            params={"date_from": "2026-02-01", "date_to": "2026-02-28"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        assert res.json()["deleted"] == 1  # only the Feb record

    def test_clear_achats_empty_when_no_data(self, client, test_owner):
        res = client.delete("/data/achats", headers=test_owner["headers"])
        assert res.status_code == 200
        assert res.json()["deleted"] == 0

    def test_clear_achats_scoped_to_own_pharmacy(self, client, db, test_owner):
        """Deleting achats only affects the current user's pharmacy."""
        pharmacy_id = test_owner["pharmacy"].id
        _setup_achat_data(db, pharmacy_id)

        other = _other_user(db)
        med2 = make_medicament(db, pid="OTHER-ACH-001", product="Other Med")
        make_achat(db, med2, other["pharmacy"].id, delivery_ref="BL-OTHER-001")
        db.commit()

        res = client.delete("/data/achats", headers=test_owner["headers"])
        assert res.status_code == 200
        assert res.json()["deleted"] == 3  # only own pharmacy's records

        # Verify the other pharmacy's data is untouched
        from models import Achat
        remaining = db.query(Achat).filter(Achat.pharmacy_id == other["pharmacy"].id).count()
        assert remaining == 1


# ── DELETE /data/ventes ──────────────────────────────────────────────────────


class TestClearVentes:
    def test_clear_all_ventes(self, client, db, test_owner):
        pharmacy_id = test_owner["pharmacy"].id
        _setup_vente_data(db, pharmacy_id)
        db.commit()

        res = client.delete("/data/ventes", headers=test_owner["headers"])
        assert res.status_code == 200
        assert res.json()["deleted"] == 3

    def test_clear_ventes_by_date_range(self, client, db, test_owner):
        pharmacy_id = test_owner["pharmacy"].id
        _setup_vente_data(db, pharmacy_id, dates=["2026-01-10", "2026-02-10", "2026-03-10"])
        db.commit()

        res = client.delete(
            "/data/ventes",
            params={"date_from": "2026-03-01", "date_to": "2026-03-31"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        assert res.json()["deleted"] == 1  # only the March record

    def test_clear_ventes_empty_when_no_data(self, client, test_owner):
        res = client.delete("/data/ventes", headers=test_owner["headers"])
        assert res.status_code == 200
        assert res.json()["deleted"] == 0


# ── GET /data/imports ────────────────────────────────────────────────────────


class TestListImports:
    def test_list_import_batches(self, client, db, test_owner):
        pharmacy_id = test_owner["pharmacy"].id
        make_import_batch(db, pharmacy_id, file_type="achat", filename="achats-jan.csv")
        make_import_batch(db, pharmacy_id, file_type="vente", filename="ventes-feb.csv")
        db.commit()

        res = client.get("/data/imports", headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 2
        filenames = {b["filename"] for b in data}
        assert "achats-jan.csv" in filenames
        assert "ventes-feb.csv" in filenames

    def test_list_imports_scoped_to_pharmacy(self, client, db, test_owner):
        pharmacy_id = test_owner["pharmacy"].id
        make_import_batch(db, pharmacy_id, filename="own-batch.csv")

        other = _other_user(db)
        make_import_batch(db, other["pharmacy"].id, filename="foreign-batch.csv")
        db.commit()

        res = client.get("/data/imports", headers=test_owner["headers"])
        assert res.status_code == 200
        filenames = {b["filename"] for b in res.json()}
        assert "own-batch.csv" in filenames
        assert "foreign-batch.csv" not in filenames

    def test_list_imports_empty(self, client, test_owner):
        res = client.get("/data/imports", headers=test_owner["headers"])
        assert res.status_code == 200
        assert res.json() == []

    def test_import_batch_fields(self, client, db, test_owner):
        """Verify the returned batch includes expected fields."""
        make_import_batch(
            db, test_owner["pharmacy"].id,
            file_type="achat",
            filename="fields-test.csv",
            rows_inserted=50,
            rows_skipped=3,
        )
        db.commit()

        res = client.get("/data/imports", headers=test_owner["headers"])
        assert res.status_code == 200
        batch = res.json()[0]
        assert batch["file_type"] == "achat"
        assert batch["filename"] == "fields-test.csv"
        assert batch["rows_inserted"] == 50
        assert batch["rows_skipped"] == 3
        assert "imported_at" in batch


# ── DELETE /data/imports/{id} ────────────────────────────────────────────────


class TestDeleteImportBatch:
    def test_delete_achat_batch(self, client, db, test_owner):
        pharmacy_id = test_owner["pharmacy"].id
        batch = make_import_batch(db, pharmacy_id, file_type="achat")
        med = make_medicament(db, pid="DEL-BATCH-001", product="Batch Med")
        make_achat(db, med, pharmacy_id, delivery_ref="BL-BATCH-001", import_batch_id=batch.id)
        make_achat(db, med, pharmacy_id, delivery_ref="BL-BATCH-002", import_batch_id=batch.id)
        db.commit()

        res = client.delete(
            f"/data/imports/{batch.id}",
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        assert res.json()["deleted"] == 2

    def test_delete_vente_batch(self, client, db, test_owner):
        pharmacy_id = test_owner["pharmacy"].id
        batch = make_import_batch(db, pharmacy_id, file_type="vente")
        med = make_medicament(db, pid="DEL-VBATCH-001", product="Vente Batch Med")
        make_vente(db, med, pharmacy_id, transaction_ref="FAC-BATCH-001", import_batch_id=batch.id)
        db.commit()

        res = client.delete(
            f"/data/imports/{batch.id}",
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        assert res.json()["deleted"] == 1

    def test_delete_missing_batch_returns_404(self, client, test_owner):
        res = client.delete(
            "/data/imports/99999",
            headers=test_owner["headers"],
        )
        assert res.status_code == 404

    def test_delete_batch_wrong_pharmacy_returns_403(self, client, db, test_owner):
        other = _other_user(db)
        batch = make_import_batch(db, other["pharmacy"].id, filename="other-batch.csv")
        db.commit()

        res = client.delete(
            f"/data/imports/{batch.id}",
            headers=test_owner["headers"],
        )
        assert res.status_code == 403

    def test_delete_batch_removes_batch_record(self, client, db, test_owner):
        """After deleting a batch, it should no longer appear in imports list."""
        pharmacy_id = test_owner["pharmacy"].id
        batch = make_import_batch(db, pharmacy_id, filename="to-remove.csv")
        db.commit()

        # Delete the batch
        res = client.delete(
            f"/data/imports/{batch.id}",
            headers=test_owner["headers"],
        )
        assert res.status_code == 200

        # Verify it's gone from the list
        res2 = client.get("/data/imports", headers=test_owner["headers"])
        assert res2.status_code == 200
        ids = {b["id"] for b in res2.json()}
        assert batch.id not in ids
