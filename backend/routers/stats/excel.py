import io
from typing import Optional

import openpyxl
from openpyxl.styles import Font, PatternFill

from utils.strings import strip_percentage as _strip_pct
from .queries import _parse_tva_rate, _resolve_type


def _build_excel(
    title: str,
    period: str,
    sections: list[dict],
) -> io.BytesIO:
    """Build the comptabilité Excel report.

    sections is a list of dicts:
      [{"name": "Pharmacie", "kpis": {...}, "extra": {...}, "med_rows": [...]}, ...]

    Single-section calls keep the legacy sheet names ("Résumé" + "Produits").
    Multi-section calls (Mixte: pharmacie + parapharmacie) stack the
    summaries in one Résumé sheet and emit one Produits sheet per section.
    """

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Résumé"

    section_font = Font(bold=True, color="FFFFFF")
    section_fill = PatternFill("solid", fgColor="14B8A6")

    def write_section(heading: str, rows: list):
        ws.append([heading])
        cell = ws.cell(ws.max_row, 1)
        cell.font = section_font
        cell.fill = section_fill
        for row in rows:
            ws.append(row)
        ws.append([])

    # Header
    ws.append([title])
    ws.cell(1, 1).font = Font(bold=True, size=14)
    ws.append(["Période :", period])
    ws.append([])

    multi = len(sections) > 1
    for s in sections:
        name: Optional[str] = s.get("name") if multi else None
        kpis = s["kpis"]
        extra = s["extra"]
        adv = extra["advanced_kpis"]
        tva = extra["tva"]
        marge = extra["marge"]

        # Big banner row when in multi-section mode so each block is clearly labelled.
        if name:
            ws.append([f"━━ {name.upper()} ━━"])
            banner_cell = ws.cell(ws.max_row, 1)
            banner_cell.font = Font(bold=True, size=12, color="0F766E")
            ws.append([])

        write_section("Résumé Commercial", [
            ["Chiffre d'affaires",       round(float(kpis.get("ventes_total") or 0), 2), "MAD"],
            ["Achats totaux",             round(float(kpis.get("achats_total") or 0), 2), "MAD"],
            ["Transactions ventes",       kpis.get("ventes_count") or 0,                  ""],
            ["Ticket moyen",              adv["ticket_moyen"],                             "MAD"],
            ["Vente moyenne / jour",      adv["vente_moyenne_par_jour"],                   "MAD"],
        ])

        write_section("Analyse des Marges", [
            ["Marge brute",               marge["marge_brute_dh"], "MAD"],
            ["Marge nette (HT)",          marge["marge_nette_dh"], "MAD"],
            ["Taux de marge",             marge["marge_pct"],      "%"],
        ])

        write_section("TVA", [
            ["TVA encaissée (ventes)",    tva["tva_encaissee"],    "MAD"],
            ["TVA payée (achats)",        tva["tva_payee"],        "MAD"],
            ["TVA à déclarer",            tva["tva_a_declarer"],   "MAD"],
        ])

    ws.column_dimensions["A"].width = 38
    ws.column_dimensions["B"].width = 18
    ws.column_dimensions["C"].width = 8

    # ── One "Produits" sheet per section ─────────────────────────────────────
    for s in sections:
        name = s.get("name") if multi else None
        sheet_name = f"Produits {name}" if name else "Produits"
        ws2 = wb.create_sheet(sheet_name[:31])  # Excel sheet name limit
        med_headers = [
            "Médicament", "Catégorie", "Type", "TVA",
            "PU moy. (MAD)", "PPV TTC (MAD)", "PPV HT (MAD)",
            "Marge %", "Marge Brute (MAD)", "Marge Nette (MAD)",
            "Qté vendue", "CA TTC (MAD)", "TVA encaissée (MAD)",
        ]
        ws2.append(med_headers)
        for col in range(1, len(med_headers) + 1):
            c = ws2.cell(1, col)
            c.font = Font(bold=True, color="FFFFFF")
            c.fill = PatternFill("solid", fgColor="14B8A6")

        for r in (s.get("med_rows") or []):
            tva_rate = _parse_tva_rate(r.tva)
            avg_pu = float(r.avg_pu or 0)
            ppv    = float(r.ppv  or 0)
            qty    = float(r.qty  or 0)
            total  = float(r.total or 0)

            ppv_ht     = round(ppv / (1 + tva_rate), 4) if tva_rate > 0 and ppv else ppv
            marge_pct  = round((1 - avg_pu / ppv) * 100, 2) if ppv and avg_pu else "—"
            marge_brut = round((ppv - avg_pu) * qty, 2)      if ppv and avg_pu else "—"
            marge_net  = round((ppv_ht - avg_pu) * qty, 2)   if ppv and avg_pu else "—"
            tva_enc    = round(total * tva_rate, 2)

            ws2.append([
                r.product or "—",
                _strip_pct(r.category or ""),
                _resolve_type(r.product_type, r.category),
                r.tva or "—",
                round(avg_pu, 4) if avg_pu else "—",
                round(ppv, 4) if ppv else "—",
                round(ppv_ht, 4) if ppv else "—",
                marge_pct,
                marge_brut,
                marge_net,
                round(qty, 2),
                round(total, 2),
                tva_enc,
            ])

        ws2.column_dimensions["A"].width = 36
        ws2.column_dimensions["B"].width = 20
        ws2.column_dimensions["C"].width = 14
        ws2.column_dimensions["D"].width = 8
        ws2.column_dimensions["E"].width = 12
        ws2.column_dimensions["F"].width = 14
        ws2.column_dimensions["G"].width = 14
        ws2.column_dimensions["H"].width = 10
        ws2.column_dimensions["I"].width = 16
        ws2.column_dimensions["J"].width = 16
        ws2.column_dimensions["K"].width = 12
        ws2.column_dimensions["L"].width = 14
        ws2.column_dimensions["M"].width = 16

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf
