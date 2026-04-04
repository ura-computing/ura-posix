"""Tests for catalog request endpoints (new product, non-declare, annulation)."""

import pytest
from models import PharmacyMedicamentStatus
from tests.factories import make_achat, make_medicament, make_vente
from utils.constants import RequestStatus, RequestType, Status


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture()
def med(db, test_owner):
    """A medicament with data in the test pharmacy."""
    pharmacy_id = test_owner["pharmacy"].id
    m = make_medicament(db, pid="CAT-001", product="Amoxicilline 500mg")
    make_vente(db, m, pharmacy_id)
    make_achat(db, m, pharmacy_id)
    return m


@pytest.fixture()
def non_declared_med(db, test_owner, med):
    """A medicament that is marked as non-declared for the test pharmacy."""
    status = PharmacyMedicamentStatus(
        pharmacy_id=test_owner["pharmacy"].id,
        medicament_id=med.id,
        declared=False,
    )
    db.add(status)
    db.flush()
    return med


# ── POST /catalog-requests ───────────────────────────────────────────────────

class TestSubmitCatalogRequest:
    def test_owner_submits_new_product(self, client, test_owner):
        payload = {
            "product": "Nouveau Medicament XYZ",
            "tva": "TVA (20.00%)",
            "pph": 50.0,
            "ppv": 65.0,
            "category": "Medicament",
        }
        res = client.post("/catalog-requests", json=payload, headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        assert data["product"] == "Nouveau Medicament XYZ"
        assert data["status"] == Status.PENDING
        assert data["request_type"] == RequestType.NEW_PRODUCT
        assert data["requested_by"] == test_owner["user"].id
        assert data["pharmacy_id"] == test_owner["pharmacy"].id

    def test_admin_submits_new_product(self, client, test_admin):
        payload = {"product": "Admin Product"}
        res = client.post("/catalog-requests", json=payload, headers=test_admin["headers"])
        assert res.status_code == 200
        data = res.json()
        assert data["product"] == "Admin Product"

    def test_employee_gets_403(self, client, test_employee):
        payload = {"product": "Forbidden Product"}
        res = client.post("/catalog-requests", json=payload, headers=test_employee["headers"])
        assert res.status_code == 403

    def test_unauthenticated_gets_401(self, client):
        payload = {"product": "No Auth"}
        res = client.post("/catalog-requests", json=payload)
        assert res.status_code == 403  # HTTPBearer returns 403 for missing auth


# ── GET /catalog-requests ────────────────────────────────────────────────────

class TestListCatalogRequests:
    def _create_request(self, client, headers, product="Test Product"):
        return client.post(
            "/catalog-requests",
            json={"product": product},
            headers=headers,
        )

    def test_owner_sees_own_requests(self, client, test_owner, test_admin):
        self._create_request(client, test_owner["headers"], "Owner Product")
        res = client.get("/catalog-requests", headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        assert len(data) >= 1
        assert all(r["requested_by"] == test_owner["user"].id for r in data)

    def test_admin_sees_all_requests(self, client, test_owner, test_admin):
        self._create_request(client, test_owner["headers"], "Visible To Admin")
        res = client.get("/catalog-requests", headers=test_admin["headers"])
        assert res.status_code == 200
        data = res.json()
        assert len(data) >= 1

    def test_filter_by_status(self, client, test_owner):
        self._create_request(client, test_owner["headers"])
        res = client.get(
            "/catalog-requests",
            params={"status": "pending"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        data = res.json()
        assert all(r["status"] == Status.PENDING for r in data)

    def test_empty_list(self, client, test_owner):
        res = client.get("/catalog-requests", headers=test_owner["headers"])
        assert res.status_code == 200
        assert res.json() == []


# ── POST /catalog-requests/non-declare ───────────────────────────────────────

class TestSubmitNonDeclare:
    def test_owner_submits(self, client, test_owner, med):
        payload = {"medicament_id": med.id, "notes": "Produit non pertinent"}
        res = client.post("/catalog-requests/non-declare", json=payload, headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        assert data["request_type"] == RequestType.NON_DECLARE
        assert data["medicament_id"] == med.id
        assert data["notes"] == "Produit non pertinent"
        assert data["status"] == Status.PENDING

    def test_employee_submits(self, client, test_employee, med):
        payload = {"medicament_id": med.id}
        res = client.post("/catalog-requests/non-declare", json=payload, headers=test_employee["headers"])
        assert res.status_code == 200

    def test_admin_gets_403(self, client, test_admin, med):
        payload = {"medicament_id": med.id}
        res = client.post("/catalog-requests/non-declare", json=payload, headers=test_admin["headers"])
        assert res.status_code == 403

    def test_nonexistent_medicament_404(self, client, test_owner):
        payload = {"medicament_id": 99999}
        res = client.post("/catalog-requests/non-declare", json=payload, headers=test_owner["headers"])
        assert res.status_code == 404

    def test_product_not_in_pharmacy_400(self, client, db, test_owner):
        """Medicament exists in catalog but pharmacy has no achats/ventes for it."""
        orphan_med = make_medicament(db, pid="ORPHAN-001", product="Orphan Drug")
        payload = {"medicament_id": orphan_med.id}
        res = client.post("/catalog-requests/non-declare", json=payload, headers=test_owner["headers"])
        assert res.status_code == 400

    def test_duplicate_pending_request_400(self, client, test_owner, med):
        payload = {"medicament_id": med.id}
        res1 = client.post("/catalog-requests/non-declare", json=payload, headers=test_owner["headers"])
        assert res1.status_code == 200
        res2 = client.post("/catalog-requests/non-declare", json=payload, headers=test_owner["headers"])
        assert res2.status_code == 400
        assert "déjà en cours" in res2.json()["detail"]


# ── POST /catalog-requests/annulation ────────────────────────────────────────

class TestSubmitAnnulation:
    def test_owner_submits_annulation(self, client, test_owner, non_declared_med):
        payload = {"medicament_id": non_declared_med.id, "notes": "Remettre en rapports"}
        res = client.post("/catalog-requests/annulation", json=payload, headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        assert data["request_type"] == RequestType.ANNULATION
        assert data["status"] == Status.PENDING

    def test_admin_gets_403(self, client, test_admin, non_declared_med):
        payload = {"medicament_id": non_declared_med.id}
        res = client.post("/catalog-requests/annulation", json=payload, headers=test_admin["headers"])
        assert res.status_code == 403

    def test_product_not_excluded_400(self, client, test_owner, med):
        """Cannot request annulation if product is not non-declared."""
        payload = {"medicament_id": med.id}
        res = client.post("/catalog-requests/annulation", json=payload, headers=test_owner["headers"])
        assert res.status_code == 400
        assert "pas exclu" in res.json()["detail"]

    def test_nonexistent_medicament_404(self, client, test_owner):
        payload = {"medicament_id": 99999}
        res = client.post("/catalog-requests/annulation", json=payload, headers=test_owner["headers"])
        assert res.status_code == 404

    def test_duplicate_pending_annulation_400(self, client, test_owner, non_declared_med):
        payload = {"medicament_id": non_declared_med.id}
        res1 = client.post("/catalog-requests/annulation", json=payload, headers=test_owner["headers"])
        assert res1.status_code == 200
        res2 = client.post("/catalog-requests/annulation", json=payload, headers=test_owner["headers"])
        assert res2.status_code == 400
        assert "déjà en cours" in res2.json()["detail"]


# ── PUT /catalog-requests/{id}/approve ───────────────────────────────────────

class TestApproveCatalogRequest:
    def _submit_new_product(self, client, headers):
        payload = {
            "product": "Approvable Product",
            "tva": "TVA (10.00%)",
            "pph": 30.0,
            "ppv": 40.0,
            "category": "Medicament",
            "barcode1": "1234567890",
        }
        return client.post("/catalog-requests", json=payload, headers=headers)

    def test_admin_approves_new_product(self, client, test_owner, test_admin):
        create_res = self._submit_new_product(client, test_owner["headers"])
        req_id = create_res.json()["id"]

        res = client.put(f"/catalog-requests/{req_id}/approve", headers=test_admin["headers"])
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == RequestStatus.APPROVED
        assert data["reviewed_at"] is not None

    def test_non_admin_gets_403(self, client, test_owner):
        create_res = self._submit_new_product(client, test_owner["headers"])
        req_id = create_res.json()["id"]

        res = client.put(f"/catalog-requests/{req_id}/approve", headers=test_owner["headers"])
        assert res.status_code == 403

    def test_approve_nonexistent_404(self, client, test_admin):
        res = client.put("/catalog-requests/99999/approve", headers=test_admin["headers"])
        assert res.status_code == 404

    def test_approve_already_approved_400(self, client, test_owner, test_admin):
        create_res = self._submit_new_product(client, test_owner["headers"])
        req_id = create_res.json()["id"]

        client.put(f"/catalog-requests/{req_id}/approve", headers=test_admin["headers"])
        res = client.put(f"/catalog-requests/{req_id}/approve", headers=test_admin["headers"])
        assert res.status_code == 400
        assert "pas en attente" in res.json()["detail"]

    def test_approve_non_declare_creates_status(self, client, db, test_owner, test_admin, med):
        payload = {"medicament_id": med.id}
        create_res = client.post(
            "/catalog-requests/non-declare", json=payload, headers=test_owner["headers"],
        )
        req_id = create_res.json()["id"]

        res = client.put(f"/catalog-requests/{req_id}/approve", headers=test_admin["headers"])
        assert res.status_code == 200

        # Verify PharmacyMedicamentStatus row was created
        status_row = db.query(PharmacyMedicamentStatus).filter(
            PharmacyMedicamentStatus.pharmacy_id == test_owner["pharmacy"].id,
            PharmacyMedicamentStatus.medicament_id == med.id,
        ).first()
        assert status_row is not None
        assert status_row.declared is False

    def test_approve_annulation_removes_status(self, client, db, test_owner, test_admin, non_declared_med):
        payload = {"medicament_id": non_declared_med.id}
        create_res = client.post(
            "/catalog-requests/annulation", json=payload, headers=test_owner["headers"],
        )
        req_id = create_res.json()["id"]

        res = client.put(f"/catalog-requests/{req_id}/approve", headers=test_admin["headers"])
        assert res.status_code == 200

        # Verify PharmacyMedicamentStatus row was deleted
        status_row = db.query(PharmacyMedicamentStatus).filter(
            PharmacyMedicamentStatus.pharmacy_id == test_owner["pharmacy"].id,
            PharmacyMedicamentStatus.medicament_id == non_declared_med.id,
        ).first()
        assert status_row is None


# ── PUT /catalog-requests/{id}/reject ────────────────────────────────────────

class TestRejectCatalogRequest:
    def _submit_request(self, client, headers):
        return client.post(
            "/catalog-requests",
            json={"product": "Rejectable Product"},
            headers=headers,
        )

    def test_admin_rejects_with_reason(self, client, test_owner, test_admin):
        create_res = self._submit_request(client, test_owner["headers"])
        req_id = create_res.json()["id"]

        res = client.put(
            f"/catalog-requests/{req_id}/reject",
            json={"reason": "Produit deja existant"},
            headers=test_admin["headers"],
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == RequestStatus.REJECTED
        assert data["reject_reason"] == "Produit deja existant"
        assert data["reviewed_at"] is not None

    def test_admin_rejects_without_reason(self, client, test_owner, test_admin):
        create_res = self._submit_request(client, test_owner["headers"])
        req_id = create_res.json()["id"]

        res = client.put(
            f"/catalog-requests/{req_id}/reject",
            json={},
            headers=test_admin["headers"],
        )
        assert res.status_code == 200
        assert res.json()["status"] == RequestStatus.REJECTED

    def test_non_admin_gets_403(self, client, test_owner):
        create_res = self._submit_request(client, test_owner["headers"])
        req_id = create_res.json()["id"]

        res = client.put(
            f"/catalog-requests/{req_id}/reject",
            json={"reason": "No"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 403

    def test_reject_nonexistent_404(self, client, test_admin):
        res = client.put(
            "/catalog-requests/99999/reject",
            json={"reason": "gone"},
            headers=test_admin["headers"],
        )
        assert res.status_code == 404
