"""Import name-dedup — the same product must NOT fork into two Medicament rows.

A product imported from SALES (Sobrus numeric PID) and the SAME product imported
from the CATALOG (PID derived from name/barcode) used to create two separate rows,
splitting that product's sales, purchases, stock and margins across two records
(and inflating product counts / "new product" alerts). Both import paths now merge
by normalized product name (accent/case-insensitive, whitespace-collapsed), so a
product resolves to ONE row with its full history intact.
"""
from __future__ import annotations

import io

from sqlalchemy import func
from sqlalchemy.orm import Session

from csv_parse import existing_by_name, normalized_name
from models import Medicament
from routers.uploads import _batch_resolve_medicaments


def _count_named(db: Session, name: str) -> int:
    return db.query(func.count(Medicament.id)).filter(Medicament.product == name).scalar()


class TestNormalizedName:
    def test_strips_accents_case_and_collapses_spaces(self):
        assert normalized_name("  MIELII   4  ÉNERGY 130G ") == "mielii 4 energy 130g"

    def test_none_is_empty(self):
        assert normalized_name(None) == ""


class TestExistingByName:
    def test_matches_accent_case_and_whitespace_insensitively(self, db: Session):
        m = Medicament(pid="P-EBN", product="MIELII 4 ÉNERGY 130G", laboratoire="MIELI")
        db.add(m); db.commit()
        found = existing_by_name(db, ["mielii 4 energy 130g", "nope"])
        assert "mielii 4 energy 130g" in found
        assert found["mielii 4 energy 130g"].id == m.id

    def test_collision_prefers_the_row_with_a_laboratoire(self, db: Session):
        no_lab = Medicament(pid="P-NL", product="ASPRO 500", laboratoire=None)
        with_lab = Medicament(pid="P-WL", product="ASPRO 500", laboratoire="BAYER")
        db.add_all([no_lab, with_lab]); db.commit()
        found = existing_by_name(db, ["aspro 500"])
        assert found["aspro 500"].laboratoire == "BAYER"


class TestBulkResolverDedup:
    """The achat/vente ingest resolver (_batch_resolve_medicaments)."""

    def test_sales_pid_merges_onto_existing_catalog_row(self, db: Session):
        # catalog row: PID = normalized name, carries the laboratoire
        cat = Medicament(pid="mielii 4 energy 130g", product="MIELII 4 ENERGY 130G",
                         laboratoire="MIELI")
        db.add(cat); db.commit(); db.refresh(cat)

        # a sales row for the SAME product arrives with a different (numeric) PID
        rows = [{"PID": "123220", "Produit": "MIELII 4 ENERGY 130G"}]
        resolved, new = _batch_resolve_medicaments(db, rows)

        assert new == []                        # nothing new created
        assert resolved["123220"] == cat.id     # sales pid resolves to the catalog row
        assert _count_named(db, "MIELII 4 ENERGY 130G") == 1
        db.refresh(cat)
        assert cat.laboratoire == "MIELI"       # laboratoire preserved

    def test_two_new_same_name_rows_in_one_batch_dedup(self, db: Session):
        rows = [
            {"PID": "A1", "Produit": "NOUVEAU PRODUIT XZ"},
            {"PID": "A2", "Produit": "Nouveau  Produit  XZ"},   # same name, spacing/case
        ]
        resolved, new = _batch_resolve_medicaments(db, rows)
        assert len(new) == 1                    # only ONE row created
        assert resolved["A1"] == resolved["A2"] == new[0].id

    def test_distinct_products_still_create_distinct_rows(self, db: Session):
        rows = [
            {"PID": "B1", "Produit": "PRODUIT ALPHA"},
            {"PID": "B2", "Produit": "PRODUIT BETA"},
        ]
        _, new = _batch_resolve_medicaments(db, rows)
        assert len(new) == 2


class TestCatalogImportDedup:
    """The catalog CSV import (POST /v1/uploads/catalog)."""

    def test_catalog_merges_laboratoire_onto_sales_created_row(self, auth_admin, db: Session) -> None:
        client, _ = auth_admin
        # simulate a row the SALES import created earlier: numeric PID, no laboratoire
        sold = Medicament(pid="123220", product="MIELII 4 ENERGY 130G", laboratoire=None)
        db.add(sold); db.commit(); db.refresh(sold)

        csv = (
            "Nom,Categorie,TVA,PPV,PPH,Code barre 1,Code barre 2,Laboratoire\n"
            "MIELII 4 ENERGY 130G,Parapharmacie,TVA (20.00%),50,30,,,MIELI\n"
        ).encode()
        r = client.post(
            "/v1/uploads/catalog",
            files={"file": ("catalog.csv", io.BytesIO(csv), "text/csv")},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["inserted"] == 0 and body["updated"] == 1   # merged, not forked

        # still exactly one row, now carrying the laboratoire
        assert _count_named(db, "MIELII 4 ENERGY 130G") == 1
        db.refresh(sold)
        assert sold.laboratoire == "MIELI"
