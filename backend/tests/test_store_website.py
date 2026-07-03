"""Tests for /v1/store-website — Ma boutique en ligne.

Coverage:
- Owner endpoints (create + read + patch + featured-categories)
- Developer endpoints (list + get + claim + release + state + customization)
- Public endpoint (preview safe subset)
- Auth + role gates on every route
- One-active-request-per-pharmacy rule
- Only-claimer-can-edit rule
- State transition validation
"""
from __future__ import annotations

import pytest


BODY_REQUEST_MIN = {
    "store_name":    "Pharmacie Demo",
    "brand_palette": ["#0E9E8C", "#34CBB7"],
    "phone":         "0600000001",
    "urgency":       "ce_mois",
}


# ── Owner side ──────────────────────────────────────────────────────────────

class TestCreateRequest:
    def test_happy_path(self, auth_owner):
        client, _, pharmacy = auth_owner
        r = client.post("/v1/store-website/requests", json=BODY_REQUEST_MIN)
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["store_name"] == "Pharmacie Demo"
        assert body["pharmacy_id"] == pharmacy.id
        assert body["state"] == "soumise"
        assert body["claimed_by"] is None

    def test_unauthenticated(self, client):
        r = client.post("/v1/store-website/requests", json=BODY_REQUEST_MIN)
        assert r.status_code == 401

    def test_admin_forbidden(self, auth_admin):
        client, _ = auth_admin
        r = client.post("/v1/store-website/requests", json=BODY_REQUEST_MIN)
        assert r.status_code == 403

    def test_developer_forbidden(self, auth_developer):
        client, _ = auth_developer
        # Developer has no pharmacy — require_pharmacy_owner rejects with 400
        # (no pharmacy) OR 403 (not owner). Either way it's not 201.
        r = client.post("/v1/store-website/requests", json=BODY_REQUEST_MIN)
        assert r.status_code in (400, 403)

    def test_validation_missing_store_name(self, auth_owner):
        client, _, _ = auth_owner
        r = client.post("/v1/store-website/requests", json={**BODY_REQUEST_MIN, "store_name": ""})
        assert r.status_code == 422

    def test_validation_palette_too_short(self, auth_owner):
        client, _, _ = auth_owner
        r = client.post("/v1/store-website/requests", json={**BODY_REQUEST_MIN, "brand_palette": ["#000"]})
        assert r.status_code == 422

    def test_validation_bad_urgency(self, auth_owner):
        client, _, _ = auth_owner
        r = client.post("/v1/store-website/requests", json={**BODY_REQUEST_MIN, "urgency": "asap-nope"})
        assert r.status_code == 422

    def test_one_active_per_pharmacy_conflict(self, auth_owner):
        client, _, _ = auth_owner
        assert client.post("/v1/store-website/requests", json=BODY_REQUEST_MIN).status_code == 201
        r2 = client.post("/v1/store-website/requests", json=BODY_REQUEST_MIN)
        assert r2.status_code == 409

    def test_default_customization_bootstrapped(self, auth_owner, db):
        """POST /requests should create the customization row in the same
        transaction with defaults derived from the palette."""
        from models import StoreCustomization
        client, _, _ = auth_owner
        r = client.post("/v1/store-website/requests", json=BODY_REQUEST_MIN)
        rid = r.json()["id"]
        db.expire_all()
        cust = db.get(StoreCustomization, rid)
        assert cust is not None
        assert cust.template == "lumiere"
        assert cust.brand_colors["primary"] == "#0E9E8C"
        assert cust.brand_colors["secondary"] == "#34CBB7"
        assert cust.sections["hero"]["visible"] is True


class TestGetMyRequest:
    def test_returns_null_when_none(self, auth_owner):
        client, _, _ = auth_owner
        r = client.get("/v1/store-website/my-request")
        assert r.status_code == 200
        assert r.json() is None

    def test_returns_active_request(self, auth_owner):
        client, _, _ = auth_owner
        client.post("/v1/store-website/requests", json=BODY_REQUEST_MIN)
        r = client.get("/v1/store-website/my-request")
        assert r.status_code == 200
        body = r.json()
        assert body is not None
        assert body["store_name"] == "Pharmacie Demo"

    def test_unauthenticated(self, client):
        r = client.get("/v1/store-website/my-request")
        assert r.status_code == 401

    def test_admin_forbidden(self, auth_admin):
        client, _ = auth_admin
        assert client.get("/v1/store-website/my-request").status_code == 403


class TestPatchRequest:
    def test_happy_path_while_soumise(self, auth_owner):
        client, _, _ = auth_owner
        rid = client.post("/v1/store-website/requests", json=BODY_REQUEST_MIN).json()["id"]
        r = client.patch(f"/v1/store-website/requests/{rid}", json={"slogan": "Nouveau slogan"})
        assert r.status_code == 200, r.text
        assert r.json()["slogan"] == "Nouveau slogan"

    def test_conflict_when_not_soumise(self, auth_owner, db):
        from models import StoreWebsiteRequest
        client, _, _ = auth_owner
        rid = client.post("/v1/store-website/requests", json=BODY_REQUEST_MIN).json()["id"]
        # Simulate the dev claiming/advancing
        req = db.get(StoreWebsiteRequest, rid)
        req.state = "en_cours"
        db.commit()
        r = client.patch(f"/v1/store-website/requests/{rid}", json={"slogan": "Trop tard"})
        assert r.status_code == 409

    def test_404_other_pharmacy(self, auth_owner, make_pharmacy, make_user, db):
        """Owner A can't patch owner B's request."""
        from models import StoreCustomization, StoreWebsiteRequest
        client_a, _, _ = auth_owner
        other_pharmacy = make_pharmacy(name="OtherPharma")
        other_owner, _ = make_user(role="owner", pharmacy=other_pharmacy)
        # Manually insert other owner's request
        import uuid
        other_rid = uuid.uuid4()
        db.add(StoreWebsiteRequest(
            id=other_rid, pharmacy_id=other_pharmacy.id, owner_id=other_owner.id,
            store_name="Other", brand_palette=["#000", "#fff"], phone="0600000000",
            urgency="asap", state="soumise",
        ))
        db.add(StoreCustomization(request_id=other_rid, sections={}, brand_colors={}))
        db.commit()
        r = client_a.patch(f"/v1/store-website/requests/{other_rid}", json={"slogan": "Malicious"})
        assert r.status_code == 404


class TestPatchFeaturedCategories:
    def test_happy_path(self, auth_owner):
        client, _, _ = auth_owner
        rid = client.post("/v1/store-website/requests", json=BODY_REQUEST_MIN).json()["id"]
        r = client.patch(
            f"/v1/store-website/requests/{rid}/featured-categories",
            json={"featured_category_ids": ["cat-1", "cat-2"]},
        )
        assert r.status_code == 200, r.text
        assert r.json()["featured_category_ids"] == ["cat-1", "cat-2"]

    def test_validation_not_list(self, auth_owner):
        client, _, _ = auth_owner
        rid = client.post("/v1/store-website/requests", json=BODY_REQUEST_MIN).json()["id"]
        r = client.patch(
            f"/v1/store-website/requests/{rid}/featured-categories",
            json={"featured_category_ids": "cat-1"},
        )
        assert r.status_code == 422


# ── Developer side ──────────────────────────────────────────────────────────

class TestListRequests:
    def test_developer_sees_all_non_closed(self, auth_owner, auth_developer):
        client_owner, _, _ = auth_owner
        client_owner.post("/v1/store-website/requests", json=BODY_REQUEST_MIN)
        client_dev, _ = auth_developer
        r = client_dev.get("/v1/store-website/requests")
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_owner_forbidden(self, auth_owner):
        client, _, _ = auth_owner
        assert client.get("/v1/store-website/requests").status_code == 403

    def test_admin_forbidden(self, auth_admin):
        client, _ = auth_admin
        assert client.get("/v1/store-website/requests").status_code == 403

    def test_unauthenticated(self, client):
        assert client.get("/v1/store-website/requests").status_code == 401


class TestClaimRequest:
    def test_happy_path(self, auth_owner, auth_developer):
        client_owner, _, _ = auth_owner
        rid = client_owner.post("/v1/store-website/requests", json=BODY_REQUEST_MIN).json()["id"]
        client_dev, dev = auth_developer
        r = client_dev.post(f"/v1/store-website/requests/{rid}/claim")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["state"] == "prise_en_charge"
        assert body["claimed_by"]["id"] == dev.id

    def test_conflict_when_claimed_by_other(self, auth_owner, auth_developer, make_user, db):
        client_owner, _, _ = auth_owner
        rid = client_owner.post("/v1/store-website/requests", json=BODY_REQUEST_MIN).json()["id"]
        # Set claimed_by to a different developer
        from models import StoreWebsiteRequest
        other_dev, _ = make_user(role="developer")
        req = db.get(StoreWebsiteRequest, rid)
        req.claimed_by_id = other_dev.id
        db.commit()
        client_dev, _ = auth_developer
        r = client_dev.post(f"/v1/store-website/requests/{rid}/claim")
        assert r.status_code == 409


class TestReleaseRequest:
    def test_happy_path(self, auth_owner, auth_developer):
        client_owner, _, _ = auth_owner
        rid = client_owner.post("/v1/store-website/requests", json=BODY_REQUEST_MIN).json()["id"]
        client_dev, _ = auth_developer
        client_dev.post(f"/v1/store-website/requests/{rid}/claim")
        r = client_dev.post(f"/v1/store-website/requests/{rid}/release")
        assert r.status_code == 200
        body = r.json()
        assert body["claimed_by"] is None
        assert body["state"] == "soumise"

    def test_forbidden_for_non_claimer(self, auth_owner, auth_developer, make_user, db):
        from models import StoreWebsiteRequest
        client_owner, _, _ = auth_owner
        rid = client_owner.post("/v1/store-website/requests", json=BODY_REQUEST_MIN).json()["id"]
        other_dev, _ = make_user(role="developer")
        req = db.get(StoreWebsiteRequest, rid)
        req.claimed_by_id = other_dev.id
        req.state = "prise_en_charge"
        db.commit()
        client_dev, _ = auth_developer
        r = client_dev.post(f"/v1/store-website/requests/{rid}/release")
        assert r.status_code == 403


class TestTransitionState:
    def test_happy_path_forward(self, auth_owner, auth_developer):
        client_owner, _, _ = auth_owner
        rid = client_owner.post("/v1/store-website/requests", json=BODY_REQUEST_MIN).json()["id"]
        client_dev, _ = auth_developer
        client_dev.post(f"/v1/store-website/requests/{rid}/claim")
        r = client_dev.patch(f"/v1/store-website/requests/{rid}/state", json={"state": "en_cours"})
        assert r.status_code == 200
        assert r.json()["state"] == "en_cours"

    def test_conflict_on_illegal_transition(self, auth_owner, auth_developer):
        client_owner, _, _ = auth_owner
        rid = client_owner.post("/v1/store-website/requests", json=BODY_REQUEST_MIN).json()["id"]
        client_dev, _ = auth_developer
        client_dev.post(f"/v1/store-website/requests/{rid}/claim")
        # prise_en_charge → livree is skipped (need en_cours first)
        r = client_dev.patch(f"/v1/store-website/requests/{rid}/state", json={"state": "livree"})
        assert r.status_code == 409


class TestPatchCustomization:
    def test_happy_path(self, auth_owner, auth_developer):
        client_owner, _, _ = auth_owner
        rid = client_owner.post("/v1/store-website/requests", json=BODY_REQUEST_MIN).json()["id"]
        client_dev, _ = auth_developer
        client_dev.post(f"/v1/store-website/requests/{rid}/claim")
        r = client_dev.patch(
            f"/v1/store-website/requests/{rid}/customization",
            json={"template": "moderne", "font_pairing": "editorial"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["template"] == "moderne"
        assert body["font_pairing"] == "editorial"

    def test_forbidden_when_not_claimer(self, auth_owner, auth_developer):
        client_owner, _, _ = auth_owner
        rid = client_owner.post("/v1/store-website/requests", json=BODY_REQUEST_MIN).json()["id"]
        # dev did NOT claim it
        client_dev, _ = auth_developer
        r = client_dev.patch(
            f"/v1/store-website/requests/{rid}/customization",
            json={"template": "moderne"},
        )
        assert r.status_code == 403

    def test_brand_colors_partial_patch_preserves_untouched_keys(self, auth_owner, auth_developer):
        """The regression this covers: sending {"brand_colors": {"primary": "#FF0000"}}
        used to REPLACE the whole JSON column, wiping secondary + accent. Deep-merge
        must keep them."""
        client_owner, _, _ = auth_owner
        rid = client_owner.post("/v1/store-website/requests", json=BODY_REQUEST_MIN).json()["id"]
        client_dev, _ = auth_developer
        client_dev.post(f"/v1/store-website/requests/{rid}/claim")

        # bootstrap defaults come from the palette (["#0E9E8C", "#34CBB7"])
        r = client_dev.patch(
            f"/v1/store-website/requests/{rid}/customization",
            json={"brand_colors": {"primary": "#FF0000"}},
        )
        assert r.status_code == 200
        bc = r.json()["brand_colors"]
        assert bc["primary"]   == "#FF0000"
        assert bc["secondary"] == "#34CBB7"       # untouched — from palette[1]
        assert bc["accent"]    == "#E9C887"       # untouched — default fallback

        # And a second partial patch preserves the first
        r = client_dev.patch(
            f"/v1/store-website/requests/{rid}/customization",
            json={"brand_colors": {"secondary": "#00FF00"}},
        )
        bc = r.json()["brand_colors"]
        assert bc["primary"]   == "#FF0000"       # still there — the bug
        assert bc["secondary"] == "#00FF00"
        assert bc["accent"]    == "#E9C887"

    def test_sections_partial_patch_preserves_untouched_keys(self, auth_owner, auth_developer):
        """Same class of bug: toggling one section used to wipe the other seven."""
        client_owner, _, _ = auth_owner
        rid = client_owner.post("/v1/store-website/requests", json=BODY_REQUEST_MIN).json()["id"]
        client_dev, _ = auth_developer
        client_dev.post(f"/v1/store-website/requests/{rid}/claim")

        r = client_dev.patch(
            f"/v1/store-website/requests/{rid}/customization",
            json={"sections": {"hero": {"visible": False}}},
        )
        assert r.status_code == 200
        secs = r.json()["sections"]
        assert secs["hero"]["visible"] is False
        # every OTHER section is still visible
        for key in ("brands", "catalogue", "soldes", "featured_categories",
                    "testimonials", "contact", "footer"):
            assert secs[key]["visible"] is True, f"section {key} got wiped"

    def test_sections_deep_merges_per_section_key(self, auth_owner, auth_developer):
        """Nested-dict fields inside a section (future 'order', 'content', …) must
        also survive a partial patch that only sets `visible`."""
        client_owner, _, _ = auth_owner
        rid = client_owner.post("/v1/store-website/requests", json=BODY_REQUEST_MIN).json()["id"]
        client_dev, _ = auth_developer
        client_dev.post(f"/v1/store-website/requests/{rid}/claim")

        # Seed a hero section with an extra field alongside `visible`
        client_dev.patch(
            f"/v1/store-website/requests/{rid}/customization",
            json={"sections": {"hero": {"visible": True, "note": "sponsor A"}}},
        )
        # Now toggle only `visible` — the extra `note` must survive
        r = client_dev.patch(
            f"/v1/store-website/requests/{rid}/customization",
            json={"sections": {"hero": {"visible": False}}},
        )
        hero = r.json()["sections"]["hero"]
        assert hero["visible"] is False
        assert hero["note"]    == "sponsor A"

    def test_scalar_fields_still_replace(self, auth_owner, auth_developer):
        """Merge behaviour applies only to the two JSON-dict fields. Everything
        else keeps standard PATCH semantics (last write wins)."""
        client_owner, _, _ = auth_owner
        rid = client_owner.post("/v1/store-website/requests", json=BODY_REQUEST_MIN).json()["id"]
        client_dev, _ = auth_developer
        client_dev.post(f"/v1/store-website/requests/{rid}/claim")

        client_dev.patch(
            f"/v1/store-website/requests/{rid}/customization",
            json={"font_pairing": "editorial"},
        )
        r = client_dev.patch(
            f"/v1/store-website/requests/{rid}/customization",
            json={"font_pairing": "moderne"},
        )
        assert r.json()["font_pairing"] == "moderne"


class TestResetCustomization:
    def _make_and_claim(self, auth_owner, auth_developer, *, palette=None):
        client_owner, _, _ = auth_owner
        body = dict(BODY_REQUEST_MIN)
        if palette is not None:
            body["brand_palette"] = palette
        rid = client_owner.post("/v1/store-website/requests", json=body).json()["id"]
        client_dev, _ = auth_developer
        client_dev.post(f"/v1/store-website/requests/{rid}/claim")
        return client_dev, rid

    def test_happy_path_restores_bootstrap(self, auth_owner, auth_developer):
        client_dev, rid = self._make_and_claim(auth_owner, auth_developer)
        # First, dirty the whole customization
        client_dev.patch(f"/v1/store-website/requests/{rid}/customization", json={
            "template":     "elegance",
            "font_pairing": "editorial",
            "brand_colors": {"primary": "#FF0000", "secondary": "#00FF00", "accent": "#0000FF"},
            "sections":     {"hero": {"visible": False}, "footer": {"visible": False}},
        })
        r = client_dev.post(f"/v1/store-website/requests/{rid}/customization/reset")
        assert r.status_code == 200
        body = r.json()
        assert body["template"]     == "lumiere"
        assert body["font_pairing"] == "moderne"
        assert body["logo_url"]     is None
        assert body["featured_category_ids"] == []
        # sections back to all-visible
        assert all(v["visible"] is True for v in body["sections"].values())
        assert set(body["sections"]) == {
            "hero", "brands", "catalogue", "soldes",
            "featured_categories", "testimonials", "contact", "footer",
        }

    def test_brand_colors_rederived_from_palette(self, auth_owner, auth_developer):
        client_dev, rid = self._make_and_claim(
            auth_owner, auth_developer,
            palette=["#111111", "#222222", "#333333"],
        )
        client_dev.patch(f"/v1/store-website/requests/{rid}/customization", json={
            "brand_colors": {"primary": "#FF0000", "secondary": "#00FF00", "accent": "#0000FF"},
        })
        r = client_dev.post(f"/v1/store-website/requests/{rid}/customization/reset")
        assert r.status_code == 200
        assert r.json()["brand_colors"] == {
            "primary":   "#111111",
            "secondary": "#222222",
            "accent":    "#333333",
        }

    def test_forbidden_when_not_claimer(self, auth_owner, auth_developer):
        client_owner, _, _ = auth_owner
        rid = client_owner.post("/v1/store-website/requests", json=BODY_REQUEST_MIN).json()["id"]
        client_dev, _ = auth_developer   # did NOT claim
        r = client_dev.post(f"/v1/store-website/requests/{rid}/customization/reset")
        assert r.status_code == 403

    def test_forbidden_for_owner(self, auth_owner, auth_developer):
        client_dev, rid = self._make_and_claim(auth_owner, auth_developer)
        client_owner, _, _ = auth_owner
        r = client_owner.post(f"/v1/store-website/requests/{rid}/customization/reset")
        assert r.status_code == 403

    def test_unauthenticated(self, client):
        # Auth guard fires before the request lookup, so any UUID does — no
        # setup needed. Using the pristine `client` fixture directly (no other
        # auth_* fixture in this test's signature) avoids the shared-cookie trap.
        r = client.post(
            "/v1/store-website/requests/00000000-0000-0000-0000-000000000000/customization/reset",
        )
        assert r.status_code == 401

    def test_404_missing_request(self, auth_developer):
        client_dev, _ = auth_developer
        r = client_dev.post(
            "/v1/store-website/requests/00000000-0000-0000-0000-000000000000/customization/reset",
        )
        assert r.status_code == 404


class TestGetRequestFull:
    def test_developer_gets_customization(self, auth_owner, auth_developer):
        client_owner, _, _ = auth_owner
        rid = client_owner.post("/v1/store-website/requests", json=BODY_REQUEST_MIN).json()["id"]
        client_dev, _ = auth_developer
        r = client_dev.get(f"/v1/store-website/requests/{rid}")
        assert r.status_code == 200
        body = r.json()
        assert body["customization"]["template"] == "lumiere"


# ── Public preview ──────────────────────────────────────────────────────────

class TestPublicPreview:
    def test_404_unknown_uuid(self, client):
        r = client.get("/v1/store-website/public/preview/00000000-0000-0000-0000-000000000000")
        assert r.status_code == 404

    def test_returns_safe_subset(self, auth_owner, client):
        client_owner, _, _ = auth_owner
        rid = client_owner.post("/v1/store-website/requests", json={
            **BODY_REQUEST_MIN,
            "vision": "SECRET-VISION-STRING",
        }).json()["id"]

        # Preview endpoint requires no auth — hit with the anonymous client
        r = client.get(f"/v1/store-website/public/preview/{rid}")
        assert r.status_code == 200
        body = r.json()
        assert body["store_name"] == "Pharmacie Demo"
        assert body["pharmacy_phone"] == "0600000001"
        assert body["template"] == "lumiere"
        # Owner personal data must NOT leak
        assert "vision" not in body
        assert "owner_id" not in body
        assert "owner_name" not in body
        # Sanity: the safe subset SHOULD carry the sections + brand_colors
        assert "sections" in body
        assert "brand_colors" in body
