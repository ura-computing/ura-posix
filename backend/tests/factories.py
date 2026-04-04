"""
Test data factories — create test records with sensible defaults.
"""

import io
from sqlalchemy.orm import Session
from models import Achat, ImportBatch, Medicament, Vente


def make_medicament(
    db: Session,
    pid: str = "TEST-001",
    product: str = "Paracetamol 500mg",
    category: str = "Medicament",
    tva: str = "TVA (20.00%)",
    pph: float = 80.0,
    ppv: float = 100.0,
    **kwargs,
) -> Medicament:
    med = Medicament(pid=pid, product=product, category=category, tva=tva, pph=pph, ppv=ppv, **kwargs)
    db.add(med)
    db.flush()
    return med


def make_achat(
    db: Session,
    medicament: Medicament,
    pharmacy_id: int,
    quantity: float = 10.0,
    unit_price: float = 80.0,
    delivery_date: str = "2026-03-01",
    delivery_ref: str = "BL-001",
    supplier: str = "Grossiste A",
    **kwargs,
) -> Achat:
    total = quantity * unit_price
    achat = Achat(
        pharmacy_id=pharmacy_id,
        medicament_id=medicament.id,
        quantity=quantity,
        unit_price=unit_price,
        total=total,
        delivery_date=delivery_date,
        delivery_ref=delivery_ref,
        supplier=supplier,
        **kwargs,
    )
    db.add(achat)
    db.flush()
    return achat


def make_vente(
    db: Session,
    medicament: Medicament,
    pharmacy_id: int,
    quantity: float = 5.0,
    unit_price: float = 100.0,
    date: str = "2026-03-15",
    transaction_ref: str = "FAC-001",
    **kwargs,
) -> Vente:
    total = quantity * unit_price
    vente = Vente(
        pharmacy_id=pharmacy_id,
        medicament_id=medicament.id,
        quantity=quantity,
        unit_price=unit_price,
        total=total,
        date=date,
        transaction_ref=transaction_ref,
        **kwargs,
    )
    db.add(vente)
    db.flush()
    return vente


def make_import_batch(
    db: Session,
    pharmacy_id: int,
    file_type: str = "achat",
    filename: str = "Sobrus - Achats 2026-01-01 - 2026-03-01.csv",
    rows_inserted: int = 100,
    rows_skipped: int = 5,
) -> ImportBatch:
    batch = ImportBatch(
        pharmacy_id=pharmacy_id,
        file_type=file_type,
        filename=filename,
        rows_inserted=rows_inserted,
        rows_skipped=rows_skipped,
    )
    db.add(batch)
    db.flush()
    return batch


def make_csv_bytes(rows: list[dict], delimiter: str = ";") -> bytes:
    """Build a CSV file in-memory from a list of dicts. Returns bytes for upload."""
    if not rows:
        return b""
    headers = list(rows[0].keys())
    lines = [delimiter.join(headers)]
    for row in rows:
        lines.append(delimiter.join(str(row.get(h, "")) for h in headers))
    return "\n".join(lines).encode("utf-8")


def achat_csv_rows(
    pid: str = "TEST-001",
    product: str = "Paracetamol 500mg",
    count: int = 3,
) -> list[dict]:
    """Generate sample achat CSV rows matching Sobrus format."""
    return [
        {
            "Créée le": f"2026-03-{i+1:02d}",
            "Date Bon de Livraison": f"2026-03-{i+1:02d}",
            "Référence de livraison": f"BL-{i+1:03d}",
            "Fournisseur": "Grossiste A",
            "PID": pid,
            "Produit": product,
            "Catégorie": "Medicament",
            "TVA": "TVA (20.00%)",
            "PPH": "80.00",
            "PPV": "100.00",
            "Quantité": "10",
            "Prix unitaire": "80.00",
            "Total": "800.00",
            "Date de péremption": "2028-12-31",
            "Stock min": "5",
            "Stock max": "20",
        }
        for i in range(count)
    ]


def vente_csv_rows(
    pid: str = "TEST-001",
    product: str = "Paracetamol 500mg",
    count: int = 3,
) -> list[dict]:
    """Generate sample vente CSV rows matching Sobrus format."""
    return [
        {
            "PID": pid,
            "Produit": product,
            "Date": f"2026-03-{i+10:02d}",
            "Numéro de transaction": f"FAC-{i+1:03d}",
            "Client": "Anonyme",
            "Catégorie": "Medicament",
            "TVA": "TVA (20.00%)",
            "PPH": "80.00",
            "PPV": "100.00",
            "Quantité": "2",
            "Remise": "0",
            "Prix unitaire": "100.00",
            "Total": "200.00",
        }
        for i in range(count)
    ]
