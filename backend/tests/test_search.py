"""Unit tests for the search wildcard semantics (`search.py`).

`*` is an anchoring wildcard *inside* a token — prefix (`rino*`), suffix
(`*enil`), and infix (`ri*il`) — not a separator. These assertions pin the ILIKE
pattern builder and its in-memory Python twin so the four search paths that reuse
them (SQL endpoints + the stock page's materialized-list filter) stay in lockstep.
"""
from __future__ import annotations

from search import (
    _token_to_pattern,
    _token_to_regex_sql,
    matches_all_tokens,
    tokenize_search,
)


class TestTokenToPattern:
    def test_no_wildcard_is_substring(self):
        assert _token_to_pattern("cin") == "%cin%"

    def test_like_metachars_are_escaped(self):
        # user `%` / `_` must not act as SQL wildcards
        assert _token_to_pattern("50%") == r"%50\%%"
        assert _token_to_pattern("a_b") == r"%a\_b%"


class TestTokenToRegexSql:
    """Wildcard tokens compile to a PER-WORD Postgres regex (\\m/\\M anchors)."""

    def test_trailing_star_is_word_prefix(self):
        assert _token_to_regex_sql("rino*") == r"\mrino"

    def test_leading_star_is_word_suffix(self):
        assert _token_to_regex_sql("*enil") == r"enil\M"

    def test_infix_star_stays_within_a_word(self):
        assert _token_to_regex_sql("ri*il") == r"\mri[^[:space:]]*il\M"

    def test_regex_metachars_are_escaped(self):
        assert _token_to_regex_sql("a.b*") == r"\ma\.b"


class TestTokenizeSearch:
    def test_splits_on_whitespace_only_and_preserves_star(self):
        assert tokenize_search("rino* *enil") == ["rino*", "*enil"]

    def test_lowercases_and_dedupes(self):
        assert tokenize_search("Rino RINO rino") == ["rino"]

    def test_empty(self):
        assert tokenize_search("") == []
        assert tokenize_search(None) == []


class TestMatchesAllTokens:
    def test_substring(self):
        assert matches_all_tokens("Rinomicine", ["ino"]) is True
        assert matches_all_tokens("Rinomicine", ["xyz"]) is False

    def test_prefix(self):
        assert matches_all_tokens("Rinomicine", ["rino*"]) is True
        assert matches_all_tokens("Doliprane", ["rino*"]) is False

    def test_suffix(self):
        assert matches_all_tokens("Doliprane paracétamol", ["*enil"]) is False
        assert matches_all_tokens("Amoxicilline", ["*ine"]) is True

    def test_infix(self):
        # "ra*ol" = starts "ra", ends "ol"
        assert matches_all_tokens("Rabeprazol", ["ra*ol"]) is True
        assert matches_all_tokens("Rinomicine", ["ra*ol"]) is False

    def test_wildcard_anchors_per_word_of_a_multiword_name(self):
        product = "RINOMICINE ST B10 SACHETS"
        # the WORD "rinomicine" starts with "rinom" and ends with "ne"
        assert matches_all_tokens(product, ["rinom*ne"]) is True
        assert matches_all_tokens(product, ["rinom*"]) is True
        assert matches_all_tokens(product, ["*cine"]) is True
        # a wildcard must NOT span across words
        assert matches_all_tokens(product, ["rinom*sachets"]) is False

    def test_accent_and_case_insensitive(self):
        assert matches_all_tokens("PARACÉTAMOL", ["paracetamol"]) is True

    def test_all_tokens_must_match(self):
        assert matches_all_tokens("Doliprane 1000mg", ["doli", "1000"]) is True
        assert matches_all_tokens("Doliprane 1000mg", ["doli", "500"]) is False

    def test_empty_text(self):
        assert matches_all_tokens(None, ["x"]) is False
        assert matches_all_tokens("anything", []) is True
