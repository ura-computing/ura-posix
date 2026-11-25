"""Conditions engine (D-4): an order's lines + a supplier's rules → each line's discount and net price, the order's
totals, and what the person should know (minimum reached?, next tier, packaging, transport, payment discount).

Plain code, no database, no supplier-specific code: every supplier goes through the same rules.

  - Only rules « Confirmée » and valid today are applied; the others come back in `ignored` (shown, never applied).
  - A rule covers its products (`product_ids`), none = the whole order of that supplier.
  - Tiers are measured on every line the rule covers together (« panaché »): units for `qty_tiers`, MAD before
    discount for `amount_tiers`.
  - Rules never add up: a line gets the best discount among the rules that cover it, and says which one.
  - The next tier is shown, never added: « encore 70 unités pour 25 % ».
  - The payment discount is information only (it depends on how the pharmacy pays): never in the net price.

Example (Afric-Phar, tiers 100 → 20 %, 200 → 23 %, 300 → 25 %): 230 units at 10 MAD → 23 %, net 1 771 MAD;
next tier: 70 more units for 25 %.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

DISCOUNT_KINDS = ("qty_tiers", "amount_tiers", "product_discount")


@dataclass(frozen=True)
class Line:
    product_id: int
    quantity: int
    unit_price: float  # PPH (purchase price) before discount


@dataclass(frozen=True)
class Rule:
    id: int
    kind: str
    state: str = "confirmed"
    basis: str | None = None
    value: float | None = None
    days: int | None = None
    tiers: tuple[tuple[float, float], ...] = ()  # ((from, pct), …), ascending
    product_ids: frozenset[int] = frozenset()  # empty = the whole order
    valid_from: date | None = None
    valid_to: date | None = None


@dataclass
class LineResult:
    product_id: int
    quantity: int
    unit_price: float
    discount_pct: float = 0.0
    rule_id: int | None = None  # the rule that gave the discount
    net_unit_price: float = 0.0
    net_total: float = 0.0
    packaging: float | None = None  # multiple required, when the quantity does not respect it


@dataclass
class Minimum:
    rule_id: int
    basis: str  # units | mad | references
    required: float
    current: float
    reached: bool


@dataclass
class NextTier:
    rule_id: int
    basis: str  # units | mad
    more: float  # how much is missing for the next tier
    pct: float


@dataclass
class Result:
    lines: list[LineResult]
    gross_total: float
    net_total: float
    minimums: list[Minimum] = field(default_factory=list)
    next_tiers: list[NextTier] = field(default_factory=list)
    transport_free_from: float | None = None  # MAD; None = no rule
    transport_missing: float = 0.0  # MAD still missing for free transport
    payment_discounts: list[Rule] = field(default_factory=list)  # information only
    ignored: list[tuple[int, str]] = field(default_factory=list)  # (rule id, "unverified" | "missing" | "expired")


def _money(x: float) -> float:
    return round(x + 0.0, 2)


def _covers(rule: Rule, line: Line) -> bool:
    return not rule.product_ids or line.product_id in rule.product_ids


def _tier(tiers: tuple[tuple[float, float], ...], measure: float) -> tuple[float, tuple[float, float] | None]:
    """(pct reached, next tier or None). 230 on ((100, 20), (200, 23), (300, 25)) → (23, (300, 25))."""
    reached = 0.0
    for start, pct in tiers:
        if measure >= start:
            reached = pct
        else:
            return reached, (start, pct)
    return reached, None


def evaluate(lines: list[Line], rules: list[Rule], today: date) -> Result:
    """The order as the supplier will bill it (see the module docstring)."""
    active: list[Rule] = []
    ignored: list[tuple[int, str]] = []
    for rule in rules:
        if rule.state != "confirmed":
            ignored.append((rule.id, rule.state))
        elif (rule.valid_from and today < rule.valid_from) or (rule.valid_to and today > rule.valid_to):
            ignored.append((rule.id, "expired"))
        else:
            active.append(rule)

    def scope(rule: Rule) -> list[Line]:
        return [line for line in lines if _covers(rule, line)]

    results = [LineResult(line.product_id, line.quantity, line.unit_price) for line in lines]
    next_tiers: list[NextTier] = []

    # Each discount rule: the % it gives to the lines it covers (tiers measured on all of them together).
    for rule in (r for r in active if r.kind in DISCOUNT_KINDS):
        covered = scope(rule)
        if not covered:
            continue
        if rule.kind == "product_discount":
            pct = rule.value or 0.0
        else:
            units = rule.kind == "qty_tiers"
            measure = sum(x.quantity for x in covered) if units else sum(x.quantity * x.unit_price for x in covered)
            pct, upcoming = _tier(rule.tiers, measure)
            if upcoming:
                more = upcoming[0] - measure
                next_tiers.append(NextTier(rule.id, "units" if units else "mad", _money(more), upcoming[1]))
        for line, out in zip(lines, results):
            if _covers(rule, line) and pct > out.discount_pct:  # never added: the best one wins
                out.discount_pct, out.rule_id = pct, rule.id

    for rule in (r for r in active if r.kind == "packaging" and r.value):
        for line, out in zip(lines, results):
            if _covers(rule, line) and line.quantity % int(rule.value):
                out.packaging = rule.value

    for out in results:
        out.net_unit_price = _money(out.unit_price * (100 - out.discount_pct) / 100)
        out.net_total = _money(out.net_unit_price * out.quantity)

    minimums = []
    for rule in (r for r in active if r.kind == "minimum_order" and r.value is not None):
        covered = scope(rule)
        current = {
            "units": sum(x.quantity for x in covered),
            "mad": _money(sum(x.quantity * x.unit_price for x in covered)),
            "references": len({x.product_id for x in covered}),
        }[rule.basis or "mad"]
        minimums.append(Minimum(rule.id, rule.basis or "mad", rule.value, current, current >= rule.value))

    gross = _money(sum(line.quantity * line.unit_price for line in lines))
    net = _money(sum(out.net_total for out in results))
    transport = [r.value for r in active if r.kind == "transport" and r.value is not None]
    free_from = min(transport) if transport else None
    return Result(
        lines=results,
        gross_total=gross,
        net_total=net,
        minimums=minimums,
        next_tiers=next_tiers,
        transport_free_from=free_from,
        transport_missing=_money(max(0.0, free_from - net)) if free_from is not None else 0.0,
        payment_discounts=[r for r in active if r.kind == "payment_discount"],
        ignored=ignored,
    )
