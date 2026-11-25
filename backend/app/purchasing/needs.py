"""How many boxes to order for one product (D-6, the spec's formula). Plain code, tested in `tests/`.

    free stock  = Sobrus stock − damaged boxes − boxes reserved for « Prêt » promis   (never under 0)
    for shelf   = max(0, maximum − free stock − incoming)
    for promis  = max(0, boxes promised and not reserved yet − incoming beyond the shelf)
    need        = for shelf + for promis

Example: maximum 3, free 0, a promis of 1 waiting, nothing incoming → 3 + 1 = 4 (« 3 pour le rayon + 1 pour Mme
Alami »). `incoming` = boxes already ordered and not received (our own orders, D-9; 0 until then).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Need:
    free: int
    for_shelf: int
    for_promis: int

    @property
    def total(self) -> int:
        return self.for_shelf + self.for_promis


def need_for(current: int | None, damaged: int, reserved: int, maximum: int, waiting: int, incoming: int = 0) -> Need:
    """`current` None (not in the last stock file) counts as 0. Incoming boxes fill the shelf first, then promis."""
    free = max(0, (current or 0) - damaged - reserved)
    shelf_gap = max(0, maximum - free)
    for_shelf = max(0, shelf_gap - incoming)
    left = max(0, incoming - shelf_gap)  # incoming beyond the shelf's gap goes to the promis
    return Need(free=free, for_shelf=for_shelf, for_promis=max(0, waiting - left))
