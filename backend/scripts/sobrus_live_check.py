"""The robot's real Sobrus client against the REAL Sobrus, read-only: log in (4 steps) + a 7-day Achats export.
E2E live check (e2e/tests/21-sobrus-live.spec.ts, account from e2e/tests.env), also by hand:

    EMAIL=… PASSWORD=… SOBRUS_API_URL=https://api.pharmav4.sobrus.com \\
      SOBRUS_ACCOUNT_API_URL=https://api.account.sobrus.com uv run python -m scripts.sobrus_live_check

Prints ONE JSON line: login / SBSID2 / export status, CSV lines, its header, the error code and the robot's log
lines (step + HTTP status). Never a password, a cookie value or a line of the CSV."""

from __future__ import annotations

import json
import logging
import os
from datetime import date, timedelta

from app.ingestion.csv_parse import parse_csv
from app.sobrus.sobrus_client import SobrusClient, SobrusError


class _Lines(logging.Handler):
    def __init__(self) -> None:
        super().__init__(logging.INFO)
        self.lines: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.lines.append(record.getMessage())


def main() -> None:
    lines = _Lines()
    logging.getLogger("uvicorn.error").addHandler(lines)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    out: dict = {"login": False, "sbsid2": False, "export_status": None, "lines": 0, "header": [], "error": None}
    client = SobrusClient()
    try:
        client.login(os.environ["EMAIL"], os.environ["PASSWORD"])
        out["login"] = True
        out["sbsid2"] = any(c.name == "SBSID2" for c in client.http.cookies.jar)
        end = date.today()
        content = client.export("achat", (end - timedelta(days=7)).isoformat(), end.isoformat(), lambda n: None)
        out["export_status"] = 200
        rows = parse_csv(content)
        out["lines"] = len(rows)
        out["header"] = list(rows[0]) if rows else []
    except SobrusError as e:
        out["error"] = e.code
    finally:
        client.close()
    out["log"] = lines.lines
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
