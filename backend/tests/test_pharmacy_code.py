"""Unit tests for the pharmacy code generator."""

from models import Pharmacy
from utils.pharmacy_code import generate_pharmacy_code, _prefix_from_city


class TestPrefixFromCity:
    def test_normal_city(self):
        assert _prefix_from_city("Bouskoura") == "BOU"

    def test_strips_accents(self):
        assert _prefix_from_city("Fès") == "FES"
        assert _prefix_from_city("Ain") == "AIN"

    def test_pads_short_city(self):
        assert _prefix_from_city("Ai") == "AIX"
        assert _prefix_from_city("X") == "XXX"

    def test_handles_none_and_empty(self):
        assert _prefix_from_city(None) == "XXX"
        assert _prefix_from_city("") == "XXX"
        assert _prefix_from_city("   ") == "XXX"


class TestGeneratePharmacyCode:
    def test_first_in_city(self, db):
        assert generate_pharmacy_code(db, "Bouskoura") == "BOU0001"

    def test_increments_within_same_city(self, db):
        db.add(Pharmacy(name="A", city="Bouskoura", code="BOU0001"))
        db.add(Pharmacy(name="B", city="Bouskoura", code="BOU0002"))
        db.flush()
        assert generate_pharmacy_code(db, "Bouskoura") == "BOU0003"

    def test_independent_per_prefix(self, db):
        db.add(Pharmacy(name="A", city="Casablanca", code="CAS0001"))
        db.flush()
        # Different city → independent counter
        assert generate_pharmacy_code(db, "Bouskoura") == "BOU0001"
        # Same city → next slot
        assert generate_pharmacy_code(db, "Casablanca") == "CAS0002"

    def test_picks_max_even_with_gaps(self, db):
        db.add(Pharmacy(name="A", city="Bouskoura", code="BOU0001"))
        db.add(Pharmacy(name="B", city="Bouskoura", code="BOU0009"))
        db.flush()
        # Picks max(1, 9) + 1, not count + 1
        assert generate_pharmacy_code(db, "Bouskoura") == "BOU0010"
