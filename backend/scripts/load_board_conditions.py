"""Load the conditions board (`resources/clickup/conditions-laboratoires-board.html`, written down in
`backend/data/board_conditions.json`) into « Fournisseurs »: 20 labs, their rules « À vérifier » (D-3).

Runs at every start (entrypoint.sh, `make migrate`) and does its work once per lab:
  - the lab: found by its name or an alias, without « Laboratoire » / « Société » / « Grossiste » in front (Sobrus
    writes « Laboratoire BOTTU »), else added (kind « laboratoire »);
    its empty fields filled (phone, contact, payment, note…), a value already there never replaced;
  - its rules: added only if the lab has none from this board yet (deleted ones count: a rule the admin deleted
    never comes back). A rule for some products has no product ticked: its text names them, the admin ticks them
    when confirming (never « all the lab » by guess).

    uv run python scripts/load_board_conditions.py      # « 20 labs: 3 added, 41 rules added »
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # backend/ → `import app…`

from app.core.database import SessionLocal
from app.core.models import Supplier, SupplierCondition
from app.ingestion.csv_parse import normalized_name
from app.purchasing.supplier_names import bare_name

DATA = Path(__file__).resolve().parent.parent / "data" / "board_conditions.json"
FIELDS = ("phone", "contact_name", "address", "city", "payment_terms", "note")
ACTOR = "Tableau des conditions"


def main() -> None:
    board = json.loads(DATA.read_text(encoding="utf-8"))
    added_labs = added_rules = 0
    with SessionLocal() as db:
        # Sobrus names start with « Laboratoire », « Société », « Grossiste »: compared without them.
        by_bare: dict[str, int] = {}
        for sid, key in db.query(Supplier.id, Supplier.name_key).order_by(Supplier.id):
            by_bare.setdefault(bare_name(key), sid)
        for lab in board["labs"]:
            keys = {bare_name(lab["name"]), *(bare_name(a) for a in lab["aliases"])}
            found = [by_bare[k] for k in keys if k in by_bare]
            supplier = db.get(Supplier, min(found)) if found else None
            if supplier is None:
                supplier = Supplier(name=lab["name"], name_key=normalized_name(lab["name"]), kind="laboratoire")
                db.add(supplier)
                db.flush()
                added_labs += 1
            supplier.kind = supplier.kind or "laboratoire"
            for field in FIELDS:
                if lab.get(field) and not getattr(supplier, field):
                    setattr(supplier, field, lab[field])
            done = (
                db.query(SupplierCondition.id)
                .filter(SupplierCondition.supplier_id == supplier.id, SupplierCondition.source == board["source"])
                .first()
            )
            if done:
                continue
            for rule in lab["conditions"]:
                db.add(
                    SupplierCondition(
                        supplier_id=supplier.id,
                        kind=rule["kind"],
                        basis=rule.get("basis"),
                        value=rule.get("value"),
                        days=rule.get("days"),
                        tiers=rule.get("tiers"),
                        text=rule.get("text"),
                        state="unverified",
                        source=board["source"],
                        updated_by_name=ACTOR,
                    )
                )
                added_rules += 1
        db.commit()
    print(f"▸ Conditions board: {len(board['labs'])} labs, {added_labs} added, {added_rules} rules added")


if __name__ == "__main__":
    main()
