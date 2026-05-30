from utils.strings import classify_pharma_type, fix_mojibake, tokenize_search


class TestFixMojibake:
    def test_handles_e_acute(self):
        assert fix_mojibake("Cat√©gorie") == "Catégorie"

    def test_handles_degree_sign(self):
        # MacRoman round-trip yields ° (U+00B0 DEGREE SIGN), which is what Sobrus data actually has.
        assert fix_mojibake("HELIOCARE 360¬∞ MD A-R") == "HELIOCARE 360° MD A-R"

    def test_handles_nbsp(self):
        # NBSP either becomes a regular space (table) or stays as NBSP (round-trip)
        out = fix_mojibake("Foo¬†Bar")
        assert out in ("Foo Bar", "Foo\xa0Bar")

    def test_handles_e_grave(self):
        # Both √® and √à occur — both should resolve to è
        assert fix_mojibake("R√©f√©rence") == "Référence"
        assert fix_mojibake("Quantit√©") == "Quantité"
        assert fix_mojibake("D√®s lors") == "Dès lors"

    def test_handles_i_diaeresis(self):
        assert fix_mojibake("na√Øve") in ("naïve", "naïve")

    def test_no_op_when_clean(self):
        assert fix_mojibake("Catégorie") == "Catégorie"
        assert fix_mojibake("plain ascii") == "plain ascii"

    def test_empty_and_none(self):
        assert fix_mojibake("") == ""
        assert fix_mojibake(None) is None

    def test_mixed_clean_and_mojibake(self):
        assert fix_mojibake("Référence + Cat√©gorie") in (
            "Référence + Catégorie",
            # Round-trip may not work if half is already clean; substitution table catches it.
            "Référence + Catégorie",
        )

    def test_idempotent(self):
        once = fix_mojibake("Cat√©gorie")
        twice = fix_mojibake(once)
        assert once == twice


class TestTokenizeSearch:
    def test_blank(self):
        assert tokenize_search("") == []
        assert tokenize_search("   ") == []
        assert tokenize_search(None) == []

    def test_whitespace_split(self):
        assert tokenize_search("la roche posay") == ["la", "roche", "posay"]

    def test_star_split(self):
        assert tokenize_search("*roche*posay") == ["roche", "posay"]
        assert tokenize_search("*anthe") == ["anthe"]

    def test_mixed_separators(self):
        assert tokenize_search("la *roche posay") == ["la", "roche", "posay"]

    def test_lowercases_and_dedupes(self):
        assert tokenize_search("Roche ROCHE rocheford") == ["roche", "rocheford"]


class TestClassifyPharmaType:
    """PG-019: must stay in lockstep with _pharma_expr() in queries.py."""

    def test_medicament_categories_are_pharmacie(self):
        for cat in ("Medicament (20.00%)", "Médicament", "MEDICAMENT GENERIQUE"):
            assert classify_pharma_type(cat) == "pharmacie", cat

    def test_homeopathie_is_pharmacie(self):
        for cat in ("Homéopathie", "Homeopathie (7.00%)"):
            assert classify_pharma_type(cat) == "pharmacie", cat

    def test_dietetique_is_pharmacie_pg020(self):
        # PG-020 mirror — both accent variants.
        assert classify_pharma_type("Dietetique") == "pharmacie"
        assert classify_pharma_type("Diététique") == "pharmacie"

    def test_other_categories_are_parapharmacie(self):
        for cat in ("Parapharmacie (33.330%)", "Complement Alimentaire", "Cosmétique", None, ""):
            assert classify_pharma_type(cat) == "parapharmacie", repr(cat)

    def test_admin_product_type_override_wins(self):
        # Even a parapharmacie-keyword category must yield pharmacie if the admin
        # has explicitly overridden via Medicament.product_type.
        assert classify_pharma_type("Parapharmacie", product_type="pharmacie") == "pharmacie"
        assert classify_pharma_type("Medicament",    product_type="parapharmacie") == "parapharmacie"
