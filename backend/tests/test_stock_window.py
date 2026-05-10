"""Unit tests for the calendar-aligned ABCD analysis window."""

from datetime import date

from routers.stats.stock import stock_abcd_window


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
