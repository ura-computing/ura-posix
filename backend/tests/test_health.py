"""Sanity test for the health router + the test infrastructure itself.
If this fails, conftest.py is broken — fix infra before chasing other suites."""
from fastapi.testclient import TestClient


class TestHealth:
    def test_happy_path(self, client: TestClient) -> None:
        r = client.get("/v1/health")
        assert r.status_code == 200
        body = r.json()
        assert body == {"status": "ok", "db": "ok"}

    def test_no_auth_required(self, client: TestClient) -> None:
        # /health is intentionally public; no cookie should be required.
        r = client.get("/v1/health")
        assert r.status_code == 200
