"""Unit tests for the calendar-aligned ABCD analysis window."""

from datetime import date

import pytest

from routers.stats.stock import (
    _stock_min_for,
    _stock_max_for,
    _stock_status_from_coverage,
    stock_abcd_window,
)


class TestStockAbcdWindow:
    def test_january_returns_previous_year(self):
        assert stock_abcd_window(date(2026, 1, 15)) == (
            date(2025, 1, 1),
            date(2025, 12, 31),
        )

    def test_may_returns_previous_year(self):
        # User-given example: on 2026-05-02 → 2025-01-01 to 2025-12-31
        assert stock_abcd_window(date(2026, 5, 2)) == (
            date(2025, 1, 1),
            date(2025, 12, 31),
        )

    def test_june_30_still_previous_year(self):
        assert stock_abcd_window(date(2026, 6, 30)) == (
            date(2025, 1, 1),
            date(2025, 12, 31),
        )

    def test_july_1_switches_to_rolling(self):
        # User-given example: on 2026-07-01 → 2025-07-01 to 2026-06-30
        assert stock_abcd_window(date(2026, 7, 1)) == (
            date(2025, 7, 1),
            date(2026, 6, 30),
        )

    def test_december_still_rolling(self):
        assert stock_abcd_window(date(2026, 12, 31)) == (
            date(2025, 7, 1),
            date(2026, 6, 30),
        )


class TestStockStatusBands:
    """PG-001/PG-002: client-confirmed 4-band status keyed on days-of-coverage."""

    @pytest.mark.parametrize("current_stock, units_sold_12m, expected", [
        # ─── boundary walk ───────────────────────────────────────────────
        # days = current_stock × 365 / units_sold_12m
        (0,    365, "sous-stock"),     # 0 days
        (45,   365, "sous-stock"),     # 45 days
        (46,   365, "ideal"),          # 46 days
        (60,   365, "ideal"),          # 60 days
        (61,   365, "a-surveiller"),   # 61 days
        (99,   365, "a-surveiller"),   # 99 days
        (100,  365, "sur-stock"),      # 100 days
        (200,  365, "sur-stock"),
        # ─── DOLIPRANE 1000MG B10 client repro ───────────────────────────
        # ventes_12m=2359, stock_actuel=258 → 258·365/2359 ≈ 39.92 → sous-stock
        (258, 2359, "sous-stock"),
    ])
    def test_band(self, current_stock, units_sold_12m, expected):
        assert _stock_status_from_coverage(current_stock, units_sold_12m) == expected

    def test_inconnu_when_no_sales_history(self):
        # ventes_12m == 0 → can't compute coverage meaningfully
        assert _stock_status_from_coverage(50, 0) == "inconnu"

    def test_inconnu_when_current_stock_missing(self):
        assert _stock_status_from_coverage(None, 365) == "inconnu"

    def test_negatif_kept_as_data_quality_signal(self):
        assert _stock_status_from_coverage(-3, 365) == "negatif"


class TestStockMinMax:
    """PG-001/PG-002: displayed Stock Min/Max derived from the idéal band × avg daily sales."""

    def test_min_max_for_doliprane(self):
        # ventes_12m = 2359 → Stock Min = round(2359×45/365) = 291,
        #                      Stock Max = round(2359×60/365) = 388.
        assert _stock_min_for(2359) == 291
        assert _stock_max_for(2359) == 388

    def test_min_max_round_correctly_for_one_per_day(self):
        # exactly one sale per day → min = 45, max = 60.
        assert _stock_min_for(365) == 45
        assert _stock_max_for(365) == 60

    def test_zero_or_missing_sales_history_returns_zero(self):
        for units in (0, None):
            assert _stock_min_for(units) == 0
            assert _stock_max_for(units) == 0
