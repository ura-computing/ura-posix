"""How many boxes to order (D-6): the spec's formula. No database.

cd backend && uv run python -m unittest discover tests
"""

from __future__ import annotations

import unittest

from app.purchasing.needs import need_for


class Needs(unittest.TestCase):
    def test_spec_example_shelf_plus_promis(self):
        # min 2, max 3, free 0, one promis waiting → 3 + 1 = 4.
        n = need_for(current=0, damaged=0, reserved=0, maximum=3, waiting=1)
        self.assertEqual((n.free, n.for_shelf, n.for_promis, n.total), (0, 3, 1, 4))

    def test_damaged_and_reserved_are_not_free(self):
        # Sobrus 10, 2 damaged, 1 reserved → free 7; max 9 → 2 for the shelf.
        n = need_for(current=10, damaged=2, reserved=1, maximum=9, waiting=0)
        self.assertEqual((n.free, n.for_shelf), (7, 2))

    def test_free_stock_never_under_zero(self):
        n = need_for(current=1, damaged=3, reserved=0, maximum=2, waiting=0)
        self.assertEqual((n.free, n.for_shelf), (0, 2))

    def test_full_shelf_orders_nothing(self):
        n = need_for(current=12, damaged=0, reserved=0, maximum=10, waiting=0)
        self.assertEqual(n.total, 0)

    def test_not_in_stock_file_counts_as_zero(self):
        self.assertEqual(need_for(current=None, damaged=0, reserved=0, maximum=4, waiting=0).for_shelf, 4)

    def test_incoming_fills_the_shelf_first_then_the_promis(self):
        # Gap of 3 on the shelf, 2 promised, 4 already ordered → shelf full, 1 promis box still to order.
        n = need_for(current=0, damaged=0, reserved=0, maximum=3, waiting=2, incoming=4)
        self.assertEqual((n.for_shelf, n.for_promis), (0, 1))


if __name__ == "__main__":
    unittest.main()
