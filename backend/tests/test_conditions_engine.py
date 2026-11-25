"""The conditions engine's rules (D-4), on the board's real examples. No database.

cd backend && uv run python -m unittest discover tests
"""

from __future__ import annotations

import unittest
from datetime import date

from app.purchasing.conditions_engine import Line, Rule, evaluate

TODAY = date(2026, 11, 25)
AFRIC_PHAR = Rule(1, "qty_tiers", tiers=((100, 20), (200, 23), (300, 25)))


class Tiers(unittest.TestCase):
    def test_qty_tier_reached_and_next_one_shown(self):
        # Afric-Phar: 230 units → tier 200 (23 %); 70 more units for 25 %.
        r = evaluate([Line(10, 130, 10.0), Line(11, 100, 10.0)], [AFRIC_PHAR], TODAY)
        self.assertEqual([x.discount_pct for x in r.lines], [23, 23])
        self.assertEqual(r.gross_total, 2300.0)
        self.assertEqual(r.net_total, 1771.0)
        self.assertEqual([(n.more, n.pct, n.basis) for n in r.next_tiers], [(70, 25, "units")])

    def test_under_the_first_tier_no_discount(self):
        r = evaluate([Line(10, 99, 10.0)], [AFRIC_PHAR], TODAY)
        self.assertEqual(r.lines[0].discount_pct, 0)
        self.assertEqual(r.next_tiers[0].more, 1)

    def test_last_tier_has_no_next(self):
        r = evaluate([Line(10, 300, 10.0)], [AFRIC_PHAR], TODAY)
        self.assertEqual(r.lines[0].discount_pct, 25)
        self.assertEqual(r.next_tiers, [])

    def test_amount_tiers_gsk_real_order(self):
        # GSK: from 14 900 → 12 %, from 24 900 → 14 %; the November 2024 order (27 675,46 MAD) got 14 %.
        gsk = Rule(2, "amount_tiers", tiers=((14900, 12), (24900, 14)))
        r = evaluate([Line(20, 1, 27675.46)], [gsk], TODAY)
        self.assertEqual(r.lines[0].discount_pct, 14)

    def test_tiers_measured_on_the_rule_products_only_panache(self):
        # Strepsils (panaché) 30 → 16 %, 40 → 20 %: 25 + 15 Strepsils = 40 → 20 %; the other product gets nothing.
        strepsils = Rule(3, "qty_tiers", tiers=((30, 16), (40, 20)), product_ids=frozenset({1, 2}))
        r = evaluate([Line(1, 25, 5.0), Line(2, 15, 5.0), Line(9, 100, 5.0)], [strepsils], TODAY)
        self.assertEqual([x.discount_pct for x in r.lines], [20, 20, 0])


class NeverAdded(unittest.TestCase):
    def test_best_discount_wins_and_says_which_rule(self):
        tiers = Rule(1, "qty_tiers", tiers=((10, 10),))
        product = Rule(2, "product_discount", value=15, product_ids=frozenset({5}))
        r = evaluate([Line(5, 20, 10.0), Line(6, 20, 10.0)], [tiers, product], TODAY)
        self.assertEqual([(x.discount_pct, x.rule_id) for x in r.lines], [(15, 2), (10, 1)])


class OnlyConfirmedAndValid(unittest.TestCase):
    def test_unverified_and_expired_are_shown_not_applied(self):
        unsure = Rule(1, "product_discount", value=50, state="unverified")
        old = Rule(2, "product_discount", value=40, valid_to=date(2025, 12, 31))
        later = Rule(3, "product_discount", value=30, valid_from=date(2027, 1, 1))
        r = evaluate([Line(1, 1, 100.0)], [unsure, old, later], TODAY)
        self.assertEqual(r.lines[0].discount_pct, 0)
        self.assertEqual(r.ignored, [(1, "unverified"), (2, "expired"), (3, "expired")])


class OrderChecks(unittest.TestCase):
    def test_minimum_in_units_bottu(self):
        bottu = Rule(1, "minimum_order", basis="units", value=200)
        r = evaluate([Line(1, 150, 10.0)], [bottu], TODAY)
        self.assertEqual((r.minimums[0].current, r.minimums[0].reached), (150, False))
        r = evaluate([Line(1, 150, 10.0), Line(2, 50, 10.0)], [bottu], TODAY)
        self.assertTrue(r.minimums[0].reached)

    def test_minimum_in_mad_and_references(self):
        mad = Rule(1, "minimum_order", basis="mad", value=5000)
        refs = Rule(2, "minimum_order", basis="references", value=3)
        r = evaluate([Line(1, 10, 100.0), Line(2, 10, 100.0)], [mad, refs], TODAY)
        self.assertEqual([(m.current, m.reached) for m in r.minimums], [(2000.0, False), (2, False)])

    def test_packaging_multiple_gaviscon(self):
        gaviscon = Rule(1, "packaging", value=12, product_ids=frozenset({7}))
        r = evaluate([Line(7, 30, 20.0), Line(8, 30, 20.0)], [gaviscon], TODAY)
        self.assertEqual([x.packaging for x in r.lines], [12, None])
        r = evaluate([Line(7, 36, 20.0)], [gaviscon], TODAY)
        self.assertIsNone(r.lines[0].packaging)

    def test_transport_free_from_on_the_net_amount(self):
        transport = Rule(1, "transport", value=1500)
        r = evaluate([Line(1, 10, 100.0)], [transport], TODAY)
        self.assertEqual((r.transport_free_from, r.transport_missing), (1500, 500.0))

    def test_payment_discount_is_information_only(self):
        escompte = Rule(1, "payment_discount", value=2, days=0)
        r = evaluate([Line(1, 10, 100.0)], [escompte], TODAY)
        self.assertEqual(r.net_total, 1000.0)
        self.assertEqual([p.id for p in r.payment_discounts], [1])


if __name__ == "__main__":
    unittest.main()
