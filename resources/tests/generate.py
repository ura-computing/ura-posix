#!/usr/bin/env python3
"""Deterministic generator of HUGE Sobrus-format CSVs + their expected results.

Usage (from the repo root):
    python3 resources/tests/generate.py                  # 100 000 vente lines
    python3 resources/tests/generate.py --rows 1000000   # stress test
    python3 resources/tests/generate.py --seed 7 --today 2026-09-29

Outputs (git-ignored, regenerated on every run):
    resources/tests/achats/Sobrus - Achats <from> - <to>.csv
    resources/tests/ventes/Sobrus - Ventes <from> - <to>.csv
    resources/tests/stock/Sobrus - Stock <yyyymmdd>.csv
    resources/tests/liste/liste.csv                    (Analyses → Liste mode)
    resources/tests/catalog/catalog.csv                (admin catalogue import: 5 new products)
    resources/tests/catalog/product-infos.json         (scraped photos fixture: backend PRODUCT_INFOS_FILE)
    resources/tests/extra/Sobrus - Achats <d> - <d>.csv (2400 extra lines: import then cancel / delete)
    resources/tests/expected.json                      (oracle.py: every value, field by field)

Data design (keeps expected values exact and unambiguous):
- one PPV / PPH / category / TVA per product, identical in all 3 files
- one main supplier per product; 1 bought product in 4 is also bought from a 2nd supplier
  (G3; the real files: 1 in 2). Product names are unique ("E2E PRODUIT 00042")
- (BL, product) and (ticket, product) pairs are unique, except 3 lines of each file
  repeated at the end (same values, like the real Sobrus files): both are stored (G1)
- ~3 % products bought ABOVE their PPV (negative margin), ~5 % never bought
  (ventes sans achat), 10 stock-only products (never sold, never bought)
- dates are relative to --today so "today"-based windows stay valid
- B8: 40 lines of each file and 1 stock expiry in 25 are written like a file saved again
  by hand in Excel (23/1/26, « 05/02/2026 », 23.01.2026 14:19): the app reads the same day
"""
from __future__ import annotations

import argparse
import csv
import json
import random
import time
from collections import defaultdict
from dataclasses import dataclass, replace
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path

from oracle import Oracle


HERE = Path(__file__).resolve().parent

# Header order copied from real Sobrus exports.
ACHAT_HEADER = [
    "Créée le", "Date Bon de Livraison", "Référence de livraison", "Fournisseur", "PID",
    "Produit", "TVA", "PPH", "PPV", "Catégorie", "Zone", "Quantité", "Prix unitaire",
    "Date de péremption", "Stock min", "Stock max", "Total",
]
VENTE_HEADER = [
    "PID", "Produit", "Date", "Numéro de transaction", "Client", "TVA", "PPH", "PPV",
    "Catégorie", "Zone", "Quantité", "Remise", "Prix unitaire", "Total",
]
STOCK_HEADER = [
    "PID", "Produit", "Catégorie", "TVA", "PPV", "PPH", "Zone", "Stock",
    "Date de péremption", "Stock min", "Stock max", "Code barre 1", "Code barre 2",
]
CATALOG_HEADER = ["Nom", "Categorie", "TVA", "PPV", "PPH", "Code barre 1", "Code barre 2", "Laboratoire"]   # resources/catalog.csv

# (label, is_pharmacie). Two "Médicament" variants on purpose: reports must merge
# the "(xx%)" suffix into ONE "Médicament" bucket.
CATEGORIES = [
    ("Médicament (33.930%)", True),
    ("Médicament (30.000%)", True),
    ("Homéopathie (25.000%)", True),
    ("Diététique (20.000%)", True),
    ("Parapharmacie (25.000%)", False),
    ("Hygiène (30.000%)", False),
    ("Cosmétique (35.000%)", False),
    ("Bébé (20.000%)", False),
]
TVA_LABELS = {0.0: "Exonéré (0.00%)", 7.0: "TVA (7.00%)", 20.0: "TVA (20.00%)"}
GROSSISTES = ["Grossiste CPM CASA", "Grossiste SOPHACA", "GROSSISTE SOREMED"]
LABS = ["Laboratoire WELEDA", "Société PIERRE FABRE", "Laboratoire BIODERMA"]
ZONES = ["1.1  COMPRIME ", "2.3 SIROP", "5.7 conseil", "RAYON BEBE"]


# ─── Data model ──────────────────────────────────────────────────────────────

@dataclass(slots=True)
class Product:
    pid:      str
    name:     str
    category: str
    pharma:   bool
    tva:      float           # percent (0, 7, 20)
    pph:      float
    ppv:      float
    zone:     str
    barcode:  str
    supplier: str | None      # None → never bought
    weight:   float           # sales popularity; 0 → never sold
    stock:    int | None      # None → not in the stock file
    expiry:   date | None

    @property
    def tva_label(self) -> str:
        return TVA_LABELS[self.tva]


@dataclass(slots=True)
class Vente:
    seq:      int             # line index in the CSV = insertion order (id order)
    day:      date
    ref:      str
    p:        Product
    qty:      int
    discount: float           # percent
    unit:     float
    total:    float
    client:   str             # "" → anonymous
    hand:     bool = False    # date written as typed by hand (B8)


@dataclass(slots=True)
class Achat:
    seq:      int
    day:      date
    created:  str
    ref:      str
    supplier: str
    p:        Product
    qty:      int
    unit:     float
    total:    float
    hand:     bool = False


# ─── Generation ──────────────────────────────────────────────────────────────

def random_expiry(rng: random.Random, today: date) -> date | None:
    """Spread expiries over every péremption bucket (<6 m = 180 d, <12 m = 360 d)."""
    r = rng.random()
    if r < 0.10:
        return None
    if r < 0.20:
        return today - timedelta(days=rng.randint(1, 300))
    if r < 0.35:
        return today + timedelta(days=rng.randint(0, 179))
    if r < 0.50:
        return today + timedelta(days=rng.randint(180, 359))
    return today + timedelta(days=rng.randint(360, 900))


def make_products(rng: random.Random, n: int, today: date) -> list[Product]:
    products: list[Product] = []
    for i in range(n):
        category, pharma = rng.choice(CATEGORIES)
        tva = 0.0 if pharma else rng.choice([7.0, 20.0, 20.0])
        ppv = round(rng.uniform(5, 400), 2)
        if rng.random() < 0.03:
            pph = round(ppv * 1.10, 2)                         # negative margin
        else:
            pph = round(ppv / rng.uniform(1.15, 1.60), 2)
        stock_only = i >= n - 10
        supplier = None if stock_only or rng.random() < 0.05 else rng.choice(GROSSISTES + LABS)
        in_stock = stock_only or rng.random() < 0.90
        stock = expiry = None
        if in_stock:
            r = rng.random()
            stock = rng.randint(-5, -1) if r < 0.01 else 0 if r < 0.05 else rng.randint(1, 80)
            expiry = random_expiry(rng, today)
        products.append(Product(
            pid=str(900000 + i),
            name=f"E2E PRODUIT {i:05d}",
            category=category, pharma=pharma, tva=tva, pph=pph, ppv=ppv,
            zone=rng.choice(ZONES), barcode=f"6119{i:09d}",
            supplier=supplier,
            weight=0.0 if stock_only else 1.0 / (i + 1) ** 0.8,   # few best-sellers, long tail
            stock=stock, expiry=expiry,
        ))
    return products


def make_ventes(rng: random.Random, products: list[Product], n_lines: int,
                start: date, end: date) -> list[Vente]:
    sold = [p for p in products if p.weight > 0]
    weights = [p.weight for p in sold]
    span = (end - start).days
    lines: list[Vente] = []
    ticket = 0
    while len(lines) < n_lines:
        ticket += 1
        day = start + timedelta(days=rng.randint(0, span))
        k = min(rng.choice([1, 1, 1, 2, 2, 3, 4]), n_lines - len(lines))
        picks = {p.pid: p for p in rng.choices(sold, weights, k=k)}   # distinct per ticket
        client = f"CLIENT {rng.randint(1, 40):03d}" if rng.random() < 0.30 else ""
        for p in picks.values():
            qty = rng.choice([1, 1, 1, 2, 2, 3])
            discount = rng.choices([0.0, 5.0, 10.0, 25.0], [85, 8, 4, 3])[0]
            unit = round(p.ppv * (1 - discount / 100), 2)
            lines.append(Vente(len(lines), day, f"FAC-{ticket}", p, qty, discount, unit, round(qty * unit, 2), client))
    return lines


def make_achats(rng: random.Random, products: list[Product], n_lines: int,
                start: date, end: date) -> list[Achat]:
    by_supplier: dict[str, list[Product]] = defaultdict(list)
    for p in products:
        if p.supplier:
            by_supplier[p.supplier].append(p)
    suppliers = sorted(by_supplier)
    span = (end - start).days
    lines: list[Achat] = []
    ref = 100000
    while len(lines) < n_lines:
        ref += 1
        supplier = rng.choice(suppliers)
        pool = by_supplier[supplier]
        day = start + timedelta(days=rng.randint(0, span))
        created = datetime.combine(day, datetime.min.time()) + timedelta(
            days=rng.randint(0, 5), seconds=rng.randint(8 * 3600, 19 * 3600))
        k = min(rng.randint(3, 15), len(pool), n_lines - len(lines))
        for p in rng.sample(pool, k):                               # distinct per BL
            qty = rng.randint(2, 12)                                # ≈ units sold over the period
            unit = round(p.pph * (1 - rng.choice([0.0, 0.05, 0.10])), 2)   # PU = PPH × (1 − remise)
            lines.append(Achat(len(lines), day, created.strftime("%Y-%m-%d %H:%M:%S"), str(ref),
                               supplier, p, qty, unit, round(qty * unit, 2)))
    return lines


def add_second_suppliers(rng: random.Random, products: list[Product], achats: list[Achat],
                         start: date, end: date) -> None:
    """G3: 1 bought product in 4 also comes from another supplier, on its own BLs
    (refs 200001…), at its PPH minus that supplier's own discount."""
    bought = [p for p in products if p.supplier]
    by_second: dict[str, list[Product]] = defaultdict(list)
    for p in rng.sample(bought, len(bought) // 4):
        by_second[rng.choice([s for s in GROSSISTES + LABS if s != p.supplier])].append(p)
    span = (end - start).days
    ref = 200000
    for supplier in sorted(by_second):
        pool = by_second[supplier]
        for _ in range(max(1, len(pool) // 2)):
            ref += 1
            day = start + timedelta(days=rng.randint(0, span))
            created = datetime.combine(day, datetime.min.time()) + timedelta(seconds=rng.randint(8 * 3600, 19 * 3600))
            for p in rng.sample(pool, min(rng.randint(3, 10), len(pool))):
                qty = rng.randint(2, 12)
                unit = round(p.pph * (1 - rng.choice([0.0, 0.05, 0.10, 0.15])), 2)
                achats.append(Achat(len(achats), day, created.strftime("%Y-%m-%d %H:%M:%S"), str(ref),
                                    supplier, p, qty, unit, round(qty * unit, 2)))


def repeat_lines(rng: random.Random, lines: list) -> None:
    """G1: 3 lines appear twice in their file (same BL / ticket + product, same
    values). Both are real and both are stored; the 2nd copy sits at the end, in
    another import chunk than the 1st."""
    for line in rng.sample(lines, 3):
        lines.append(replace(line, seq=len(lines)))


def mark_hand_edited(rng: random.Random, lines: list) -> None:
    """B8: 40 lines get their dates written like a file saved again by hand. The app
    keeps minutes only for « Créée le » there, so the line's own value drops its seconds."""
    for line in rng.sample(lines, 40):
        line.hand = True
        if isinstance(line, Achat):
            line.created = line.created[:16] + ":00"


def make_liste(rng: random.Random, products: list[Product], ventes: list[Vente],
               df: date, dt: date) -> list[dict]:
    """Analyses → Liste input: sold products (exact names), a stock-only product,
    a product found only by its PID, and 2 unknown names."""
    sold = sorted({v.p.pid: v.p for v in ventes if df <= v.day <= dt}.values(), key=lambda p: p.pid)
    stock_only = [p for p in products if p.weight == 0]
    picks = rng.sample(sold, min(10, len(sold)))
    by_pid = next(p for p in sold if p not in picks)
    items = [{"name": p.name, "pid": None} for p in picks]
    items.append({"name": stock_only[0].name, "pid": None})
    items.append({"name": "REFERENCE PAR PID SEULEMENT", "pid": by_pid.pid})
    items += [{"name": "PRODUIT INCONNU ALPHA", "pid": None}, {"name": "PRODUIT INCONNU BETA", "pid": None}]
    return items


def make_extra_achats(rng: random.Random, products: list[Product], day: date) -> list[Achat]:
    """Imports spec: 2400 lines (= 2 chunks of 2000) of known products at their own
    PPH / PPV, on new BL refs. The test cancels one upload and deletes another,
    so no number of the app changes."""
    bought = [p for p in products if p.supplier]
    lines: list[Achat] = []
    bl = 0
    while len(lines) < 2400:
        bl += 1
        for p in rng.sample(bought, min(10, 2400 - len(lines))):   # distinct per BL
            qty = rng.randint(1, 5)
            lines.append(Achat(len(lines), day, f"{day} 10:00:00", f"E2E-EXTRA-{bl:03d}",
                               p.supplier, p, qty, p.pph, round(qty * p.pph, 2)))
    return lines


def make_catalog() -> list[dict]:
    """Admin catalogue import: 5 NEW products (never sold, never bought)."""
    return [{"product": f"E2E CATALOGUE {i:03d}", "category": "Parapharmacie (25.000%)", "tva": "TVA (20.00%)",
             "ppv": 50.0 + i, "pph": 35.0 + i, "barcode1": f"6120000000{i:03d}", "barcode2": None,
             "laboratoire": "Laboratoire E2E"} for i in range(1, 6)]


# Scraped photos fixture (backend PRODUCT_INFOS_FILE, e2e/docker-compose.e2e.yml). The photos
# are the E2E frontend's own files: no internet needed.
PHOTO_URL = "http://localhost:5174/favicon.svg"
PHOTO_URL_2 = "http://localhost:5174/icons.svg"
DEAD_PHOTO_URL = "http://localhost:5174/e2e-photo-introuvable.png"
PHOTO_BARCODE = "3760000000017"   # 18-produits gives it to a product in the admin catalogue


def make_product_infos(products, ventes, achats) -> tuple[dict, dict]:
    """The 4 first listed products (name order): 2 found by PID with photos that load, 1 by
    PID with a dead photo address, 1 by a barcode the admin catalogue gets in 18-produits —
    2 shop pages carry that barcode, the one with more photos wins (load_product_infos);
    + 1 unknown PID (never shown). Returns (file, oracle setup)."""
    linked = {p.pid for p in products if p.stock is not None} | {v.p.pid for v in ventes} | {a.p.pid for a in achats}
    first = sorted((p for p in products if p.pid in linked), key=lambda p: p.name)[:4]

    def info(name: str, pid: int | None, barcode: str | None, images: list[str]) -> dict:
        return {"pid": pid, "barcode1": barcode, "barcode2": None, "name": name, "brand": "Marque E2E",
                "category": "Soins visage", "images": images, "description": f"Description de {name}.",
                "details": [{"label": "Gamme", "value": "Gamme E2E"}, {"label": "Emballage", "value": "Tube 50 ml"}],
                "source_url": "https://boutique.example/e2e"}

    by_barcode = info(f"{first[3].name} (autre boutique)", None, PHOTO_BARCODE, [PHOTO_URL_2, PHOTO_URL])
    by_pid = [
        info(first[0].name, int(first[0].pid), None, [PHOTO_URL, PHOTO_URL_2]),
        info(first[1].name, int(first[1].pid), None, [PHOTO_URL_2]),
        info(first[2].name, int(first[2].pid), None, [DEAD_PHOTO_URL]),
    ]
    file = {"source": "E2E", "products": [
        *by_pid,
        info(first[3].name, None, PHOTO_BARCODE, [PHOTO_URL]),
        by_barcode,
        info("PRODUIT ABSENT DE LA PHARMACIE", 999999, None, [PHOTO_URL]),
    ]}
    shown = ("brand", "category", "images", "description", "details")   # GET /products/{id} « info »
    setup = {
        "infos": {p.pid: {k: e[k] for k in shown} for p, e in zip(first, [*by_pid, by_barcode])},
        "barcode": {"product": first[3].name, "barcode1": PHOTO_BARCODE},
    }
    return file, setup


# ─── CSV writers ─────────────────────────────────────────────────────────────

def _fmt(x: float) -> str:
    return f"{x:.2f}"


def _write(path: Path, header: list[str], rows, delimiter: str = ";") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    for old in path.parent.glob("*.csv"):
        old.unlink()
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter=delimiter, lineterminator="\n")
        w.writerow(header)
        w.writerows(rows)


def hand_date(d: date, k: int) -> str:
    """A date as Excel / Numbers writes it back (day first), or typed with spaces (B8)."""
    return [f"{d.day}/{d.month}/{d:%y}", f"{d:%d/%m/%Y}", f" {d:%d/%m/%Y} ", f"{d:%d.%m.%Y}"][k % 4]


def _day(line) -> str:
    return hand_date(line.day, line.seq) if line.hand else line.day.isoformat()


def _created(a) -> str:
    return f"{hand_date(date.fromisoformat(a.created[:10]), a.seq)} {a.created[11:16]}" if a.hand else a.created


def _achat_rows(achats):
    return ([_created(a), _day(a), a.ref, a.supplier, a.p.pid, a.p.name, a.p.tva_label,
             _fmt(a.p.pph), _fmt(a.p.ppv), a.p.category, a.p.zone, a.qty, _fmt(a.unit), "", "", "", _fmt(a.total)]
            for a in achats)


def write_files(products, ventes, achats, liste, extra, catalog, product_infos, start: date, end: date,
                today: date) -> dict:
    achat_path = HERE / "achats" / f"Sobrus - Achats {start} - {end}.csv"
    vente_path = HERE / "ventes" / f"Sobrus - Ventes {start} - {end}.csv"
    stock_path = HERE / "stock" / f"Sobrus - Stock {today:%Y%m%d}.csv"
    liste_path = HERE / "liste" / "liste.csv"
    extra_path = HERE / "extra" / f"Sobrus - Achats {end} - {end}.csv"
    catalog_path = HERE / "catalog" / "catalog.csv"
    infos_path = HERE / "catalog" / "product-infos.json"
    infos_path.parent.mkdir(parents=True, exist_ok=True)
    infos_path.write_text(json.dumps(product_infos, ensure_ascii=False, indent=1), encoding="utf-8")
    _write(achat_path, ACHAT_HEADER, _achat_rows(achats))
    _write(extra_path, ACHAT_HEADER, _achat_rows(extra))
    _write(catalog_path, CATALOG_HEADER, (
        [c["product"], c["category"], c["tva"], _fmt(c["ppv"]), _fmt(c["pph"]), c["barcode1"], c["barcode2"] or "",
         c["laboratoire"]] for c in catalog), delimiter=",")
    _write(vente_path, VENTE_HEADER, (
        [v.p.pid, v.p.name, _day(v), v.ref, v.client, v.p.tva_label, _fmt(v.p.pph),
         _fmt(v.p.ppv), v.p.category, v.p.zone, v.qty, _fmt(v.discount), _fmt(v.unit), _fmt(v.total)]
        for v in ventes))
    stocked = [p for p in products if p.stock is not None]
    _write(stock_path, STOCK_HEADER, (
        [p.pid, p.name, p.category, p.tva_label, _fmt(p.ppv), _fmt(p.pph), p.zone, p.stock,
         (hand_date(p.expiry, i) if i % 25 == 0 else p.expiry.isoformat()) if p.expiry else "", "", "",
         p.barcode, ""]
        for i, p in enumerate(stocked)))
    _write(liste_path, ["Produit", "PID"], ([it["name"], it["pid"] or ""] for it in liste))
    rel = lambda p: str(p.relative_to(HERE.parent.parent))   # noqa: E731 — repo-relative
    return {
        "achats": {"path": rel(achat_path), "rows": len(achats)},
        "ventes": {"path": rel(vente_path), "rows": len(ventes)},
        "stock":  {"path": rel(stock_path), "rows": len(stocked)},
        "liste":  {"path": rel(liste_path), "rows": len(liste)},
        "extra_achats": {"path": rel(extra_path), "rows": len(extra)},
        "catalog": {"path": rel(catalog_path), "rows": len(catalog)},
        "product_infos": {"path": rel(infos_path), "rows": len(product_infos["products"])},
    }


def import_section(products, ventes, achats) -> dict:
    """Import order used by the E2E suite: achats → ventes → stock (fresh DB)."""
    in_achats = {a.p.pid for a in achats}
    in_ventes = {v.p.pid for v in ventes}
    in_stock = {p.pid for p in products if p.stock is not None}
    return {
        "order": ["achats", "ventes", "stock"],
        "achats": {"inserted": len(achats), "skipped": 0, "new_medicaments": len(in_achats)},
        "ventes": {"inserted": len(ventes), "skipped": 0, "new_medicaments": len(in_ventes - in_achats)},
        "stock":  {"inserted": len(in_stock), "skipped_unknown": 0,
                   "new_medicaments": len(in_stock - in_achats - in_ventes)},
    }


def catalog_section(products, ventes, achats, catalog) -> dict:
    """Admin catalogue after the 3 imports: one Medicament per product found in
    any file (SEED_CATALOG=0), then the catalogue CSV adds `items`."""
    in_files = {a.p.pid for a in achats} | {v.p.pid for v in ventes} | {p.pid for p in products if p.stock is not None}
    imported = sorted((p for p in products if p.pid in in_files), key=lambda p: p.name)
    by_category: dict[str, int] = defaultdict(int)
    for p in imported:
        by_category[p.category] += 1
    return {
        "total": len(imported),
        "first_page": [p.name for p in imported[:25]],               # sort product asc, 25 / page
        "categories": sorted(by_category),                             # GET /admin/catalog/categories
        "by_category": dict(by_category),
        "items": catalog,
        "import": {"total_rows": len(catalog), "inserted": len(catalog), "updated": 0, "skipped": 0, "errors": []},
    }


# ─── CLI ─────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--rows", type=int, default=100_000, help="vente lines (default 100 000)")
    ap.add_argument("--achat-rows", type=int, help="achat lines (default rows / 3)")
    ap.add_argument("--products", type=int, help="distinct products (default max(300, rows / 250))")
    ap.add_argument("--seed", type=int, default=42)
    # Same « today » as the backend (app/core/utils.py: pharmacy time, Africa/Casablanca).
    ap.add_argument("--today", type=date.fromisoformat,
                    default=datetime.now(ZoneInfo("Africa/Casablanca")).date(),
                    help="reference day, YYYY-MM-DD (default: today in Casablanca)")
    args = ap.parse_args()
    if args.rows < 1000:
        ap.error("--rows must be ≥ 1000: below that, the exclusions scenario finds no product "
                 "that is both sold and bought (oracle.exclusion_scenario)")

    t0 = time.perf_counter()
    rng = random.Random(args.seed)
    today: date = args.today
    data_end = today - timedelta(days=1)
    data_start = data_end - timedelta(days=799)      # current year + previous year + margin
    window_to = data_end
    window_from = window_to - timedelta(days=363)    # < 1 year → monthly trend buckets

    products = make_products(rng, args.products or max(300, args.rows // 250), today)
    achats = make_achats(rng, products, args.achat_rows or args.rows // 3, data_start, data_end)
    ventes = make_ventes(rng, products, args.rows, data_start, data_end)
    repeat_rng = random.Random(args.seed + 2)            # own stream: the rest of the data is unchanged
    repeat_lines(repeat_rng, achats)
    repeat_lines(repeat_rng, ventes)
    add_second_suppliers(random.Random(args.seed + 4), products, achats, data_start, data_end)
    hand_rng = random.Random(args.seed + 3)              # own stream too
    mark_hand_edited(hand_rng, achats)
    mark_hand_edited(hand_rng, ventes)
    liste = make_liste(rng, products, ventes, window_from, window_to)
    extra = make_extra_achats(random.Random(args.seed + 1), products, data_end)
    catalog = make_catalog()
    product_infos, photo_setup = make_product_infos(products, ventes, achats)
    files = write_files(products, ventes, achats, liste, extra, catalog, product_infos, data_start, data_end, today)

    oracle = Oracle(products, ventes, achats, today, window_from, window_to)
    expected = {
        "meta": {"seed": args.seed, "rows": args.rows, "today": today.isoformat(),
                 "data_from": data_start.isoformat(), "data_to": data_end.isoformat(),
                 "products": len(products), "tolerance": {"dh": 0.05, "pct": 0.01}},
        "files": files,
        "import": import_section(products, ventes, achats),
        "catalog": catalog_section(products, ventes, achats, catalog),
        # Import file names: the Mouvements tab shows the file each line came from.
        **oracle.build(liste, photo_setup, {k: Path(files[k]["path"]).name for k in ("achats", "ventes")}),
    }
    (HERE / "expected.json").write_text(json.dumps(expected, ensure_ascii=False), encoding="utf-8")

    for kind, f in files.items():
        print(f"{kind:7} {f['rows']:>9,} rows  → {f['path']}")
    print(f"expected.json written · {time.perf_counter() - t0:.1f}s")


if __name__ == "__main__":
    main()
