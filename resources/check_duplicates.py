#!/usr/bin/env python3
"""
Sobrus CSV duplicate checker.

Usage:
    python check_duplicates.py <file.csv>
    python check_duplicates.py "Sobrus - Ventes 2026-01-01 - 2026-01-26.csv"

Reports:
  1. Rows duplicated by PID alone
  2. Rows duplicated by Produit name alone
  3. Rows duplicated by all fields except Zone (exact duplicate rows)
"""

import csv
import io
import sys
from collections import defaultdict
from pathlib import Path


IGNORE_COLS = {"Zone", "zone"}
SKIP_EMPTY_PID = True   # don't flag rows with no PID as "pid duplicates"


# ── Encoding detection ────────────────────────────────────────────────────────

def _decode(content: bytes) -> str:
    for enc in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            return content.decode(enc)
        except UnicodeDecodeError:
            continue
    raise ValueError("Cannot detect file encoding")


# ── CSV parsing ───────────────────────────────────────────────────────────────

def _detect_delimiter(sample: str) -> str:
    """Prefer semicolon (Sobrus default), fall back to comma."""
    if sample.count(";") >= sample.count(","):
        return ";"
    return ","


def _clean_val(v: str) -> str:
    """Strip whitespace and surrounding quotes."""
    return v.strip().strip('"').strip("'").strip()


def load_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    content = path.read_bytes()
    text = _decode(content)
    sample = text[:2000]
    delimiter = _detect_delimiter(sample)

    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    headers = [h.strip().strip('"') for h in (reader.fieldnames or [])]

    rows = []
    for i, raw in enumerate(reader, start=2):   # line 1 = header
        cleaned = {k.strip().strip('"'): _clean_val(v) for k, v in raw.items() if k}
        cleaned["__line__"] = str(i)
        rows.append(cleaned)

    # Drop completely empty rows
    rows = [r for r in rows if any(v for k, v in r.items() if k != "__line__")]
    return headers, rows


# ── Duplicate detection ───────────────────────────────────────────────────────

def _find_duplicates_by_key(rows: list[dict], key: str) -> dict[str, list[dict]]:
    """Group rows by a single column value; return groups with >1 row."""
    groups: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        val = row.get(key, "").strip()
        if SKIP_EMPTY_PID and key == "PID" and not val:
            continue
        if val:
            groups[val].append(row)
    return {k: v for k, v in groups.items() if len(v) > 1}


def _row_fingerprint(row: dict, ignore: set[str]) -> str:
    """Build a hashable key from all fields except ignored + meta ones."""
    parts = []
    for k, v in sorted(row.items()):
        if k in ignore or k == "__line__":
            continue
        parts.append(f"{k}={v.lower()}")
    return "|".join(parts)


def _find_exact_duplicates(rows: list[dict], ignore_cols: set[str]) -> dict[str, list[dict]]:
    groups: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        fp = _row_fingerprint(row, ignore_cols)
        groups[fp].append(row)
    return {k: v for k, v in groups.items() if len(v) > 1}


# ── Reporting ─────────────────────────────────────────────────────────────────

DISPLAY_COLS = ["PID", "Produit", "Date", "Quantité", "Prix unitaire", "Total",
                "Fournisseur", "Date Bon de Livraison", "Référence de livraison"]

def _display_cols(headers: list[str]) -> list[str]:
    want = [c for c in DISPLAY_COLS if c in headers]
    if not want:
        want = [h for h in headers if h not in IGNORE_COLS][:8]
    return want


def _print_group(rows: list[dict], cols: list[str]) -> None:
    col_w = {c: max(len(c), max(len(r.get(c, "")) for r in rows)) for c in cols}
    header = "  Line  | " + " | ".join(c.ljust(col_w[c]) for c in cols)
    sep = "-" * len(header)
    print(sep)
    print(header)
    print(sep)
    for r in rows:
        line = f"  {r['__line__']:>4}   | " + " | ".join(r.get(c, "").ljust(col_w[c]) for c in cols)
        print(line)


def report(path: Path) -> None:
    print(f"\n{'='*70}")
    print(f"  File: {path.name}")
    print(f"{'='*70}")

    headers, rows = load_csv(path)
    print(f"  Rows loaded : {len(rows)}")
    print(f"  Columns     : {', '.join(h for h in headers if h)}\n")

    display = _display_cols(headers)
    total_issues = 0

    # 1. PID duplicates
    pid_dups = _find_duplicates_by_key(rows, "PID")
    print(f"── [1] Duplicates by PID ({len(pid_dups)} groups) ──────────────────────────────")
    if pid_dups:
        for pid, group in pid_dups.items():
            print(f"\n  PID = '{pid}'  ({len(group)} rows)")
            _print_group(group, [c for c in display if c != "PID"])
        total_issues += sum(len(g) for g in pid_dups.values())
    else:
        print("  None found.")

    # 2. Produit duplicates
    prod_dups = _find_duplicates_by_key(rows, "Produit")
    print(f"\n── [2] Duplicates by Produit ({len(prod_dups)} groups) ──────────────────────────")
    if prod_dups:
        for prod, group in prod_dups.items():
            print(f"\n  Produit = '{prod}'  ({len(group)} rows)")
            _print_group(group, [c for c in display if c != "Produit"])
        total_issues += sum(len(g) for g in prod_dups.values())
    else:
        print("  None found.")

    # 3. Exact row duplicates (all cols except Zone)
    exact_dups = _find_exact_duplicates(rows, IGNORE_COLS | {"__line__"})
    print(f"\n── [3] Exact duplicate rows (ignoring Zone)  ({len(exact_dups)} groups) ────────")
    if exact_dups:
        for i, (_, group) in enumerate(exact_dups.items(), 1):
            print(f"\n  Group {i}  ({len(group)} identical rows)")
            _print_group(group, display)
        total_issues += sum(len(g) for g in exact_dups.values())
    else:
        print("  None found.")

    print(f"\n{'='*70}")
    if total_issues:
        print(f"  TOTAL rows involved in some duplication: {total_issues}")
    else:
        print("  No duplicates detected.")
    print(f"{'='*70}\n")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check_duplicates.py <file.csv> [file2.csv ...]")
        sys.exit(1)

    for arg in sys.argv[1:]:
        p = Path(arg)
        if not p.exists():
            print(f"File not found: {p}")
            continue
        report(p)
