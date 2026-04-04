"""Tests for upload endpoints (routers/uploads.py)."""

import io

from tests.factories import achat_csv_rows, make_csv_bytes, vente_csv_rows


# ── Helpers ──────────────────────────────────────────────────────────────────


def _upload_csv(client, path, csv_bytes, headers, filename="test.csv", batch_id=None):
    """Upload a CSV file to the given path."""
    return client.post(
        path,
        files={"file": (filename, io.BytesIO(csv_bytes), "text/csv")},
        data={"batch_id": str(batch_id)} if batch_id else {},
        headers=headers,
    )


# ── POST /uploads/achat (CSV) ───────────────────────────────────────────────


class TestUploadAchatCsv:
    def test_upload_valid_csv(self, client, test_owner):
        rows = achat_csv_rows(count=3)
        csv_bytes = make_csv_bytes(rows)
        res = _upload_csv(client, "/uploads/achat", csv_bytes, test_owner["headers"])
        assert res.status_code == 200
        body = res.json()
        assert body["inserted"] == 3
        assert "batch_id" in body

    def test_reject_non_csv_file(self, client, test_owner):
        res = client.post(
            "/uploads/achat",
            files={"file": ("data.txt", io.BytesIO(b"hello"), "text/plain")},
            headers=test_owner["headers"],
        )
        assert res.status_code == 400

    def test_reject_empty_csv(self, client, test_owner):
        # CSV with only a header row, no data rows
        csv_bytes = "PID;Produit;Quantité\n".encode("utf-8")
        res = _upload_csv(client, "/uploads/achat", csv_bytes, test_owner["headers"])
        assert res.status_code == 400

    def test_deduplicates_by_delivery_ref(self, client, test_owner):
        """Uploading the same CSV twice should skip duplicates on the second upload."""
        rows = achat_csv_rows(count=2)
        csv_bytes = make_csv_bytes(rows)

        res1 = _upload_csv(client, "/uploads/achat", csv_bytes, test_owner["headers"])
        assert res1.status_code == 200
        assert res1.json()["inserted"] == 2

        res2 = _upload_csv(client, "/uploads/achat", csv_bytes, test_owner["headers"])
        assert res2.status_code == 200
        assert res2.json()["skipped"] == 2
        assert res2.json()["inserted"] == 0


# ── POST /uploads/achat-json ────────────────────────────────────────────────


class TestUploadAchatJson:
    def test_upload_valid_json_rows(self, client, test_owner):
        rows = achat_csv_rows(count=2)
        res = client.post(
            "/uploads/achat-json",
            json={"rows": rows, "filename": "extension-upload.csv"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        body = res.json()
        assert body["inserted"] == 2
        assert "batch_id" in body

    def test_reject_empty_rows(self, client, test_owner):
        res = client.post(
            "/uploads/achat-json",
            json={"rows": []},
            headers=test_owner["headers"],
        )
        assert res.status_code == 400


# ── POST /uploads/vente (CSV) ───────────────────────────────────────────────


class TestUploadVenteCsv:
    def test_upload_valid_csv(self, client, test_owner):
        rows = vente_csv_rows(count=3)
        csv_bytes = make_csv_bytes(rows)
        res = _upload_csv(client, "/uploads/vente", csv_bytes, test_owner["headers"])
        assert res.status_code == 200
        body = res.json()
        assert body["inserted"] == 3
        assert "batch_id" in body

    def test_reject_non_csv_file(self, client, test_owner):
        res = client.post(
            "/uploads/vente",
            files={"file": ("data.xlsx", io.BytesIO(b"fake"), "application/octet-stream")},
            headers=test_owner["headers"],
        )
        assert res.status_code == 400

    def test_reject_empty_csv(self, client, test_owner):
        csv_bytes = "PID;Produit;Date\n".encode("utf-8")
        res = _upload_csv(client, "/uploads/vente", csv_bytes, test_owner["headers"])
        assert res.status_code == 400


# ── POST /uploads/vente-json ────────────────────────────────────────────────


class TestUploadVenteJson:
    def test_upload_valid_json_rows(self, client, test_owner):
        rows = vente_csv_rows(count=2)
        res = client.post(
            "/uploads/vente-json",
            json={"rows": rows, "filename": "extension-vente.csv"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        body = res.json()
        assert body["inserted"] == 2
        assert "batch_id" in body

    def test_reject_empty_rows(self, client, test_owner):
        res = client.post(
            "/uploads/vente-json",
            json={"rows": []},
            headers=test_owner["headers"],
        )
        assert res.status_code == 400


# ── Batch reuse (chunked upload) ────────────────────────────────────────────


class TestChunkedUpload:
    def test_batch_id_reuse_across_chunks(self, client, test_owner):
        """First chunk creates a batch_id; second chunk reuses it."""
        rows_chunk1 = achat_csv_rows(pid="CHUNK-001", product="Aspirin 100mg", count=2)
        rows_chunk2 = achat_csv_rows(pid="CHUNK-002", product="Ibuprofen 200mg", count=2)

        # First chunk — no batch_id
        res1 = client.post(
            "/uploads/achat-json",
            json={"rows": rows_chunk1, "filename": "chunk-test.csv"},
            headers=test_owner["headers"],
        )
        assert res1.status_code == 200
        batch_id = res1.json()["batch_id"]
        assert batch_id is not None

        # Second chunk — reuse batch_id
        res2 = client.post(
            "/uploads/achat-json",
            json={"rows": rows_chunk2, "filename": "chunk-test.csv", "batch_id": batch_id},
            headers=test_owner["headers"],
        )
        assert res2.status_code == 200
        assert res2.json()["batch_id"] == batch_id
        # Both chunks should have inserted their rows
        assert res2.json()["inserted"] == 2

    def test_csv_upload_with_batch_id(self, client, test_owner):
        """CSV upload endpoint also accepts a batch_id for chunked uploads."""
        rows1 = vente_csv_rows(pid="CSV-CHUNK-001", product="Doliprane 500mg", count=2)
        csv_bytes1 = make_csv_bytes(rows1)

        # First upload — get batch_id
        res1 = _upload_csv(client, "/uploads/vente", csv_bytes1, test_owner["headers"])
        assert res1.status_code == 200
        batch_id = res1.json()["batch_id"]

        # Second upload — reuse batch_id
        rows2 = vente_csv_rows(pid="CSV-CHUNK-002", product="Efferalgan 1g", count=1)
        csv_bytes2 = make_csv_bytes(rows2)
        res2 = _upload_csv(
            client, "/uploads/vente", csv_bytes2, test_owner["headers"],
            batch_id=batch_id,
        )
        assert res2.status_code == 200
        assert res2.json()["batch_id"] == batch_id
