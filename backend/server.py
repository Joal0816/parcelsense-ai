"""Loopback-only, dependency-free API for local ParcelSense development."""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sqlite3
import sys
import tempfile
import secrets
from contextlib import closing
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.demo_data import make_demo_csv  # noqa: E402
from ml.scripts import pipeline  # noqa: E402

DEFAULT_DB = ROOT / ".local" / "parcelsense.sqlite3"
DB_PATH = Path(os.environ.get("PARCELSENSE_DB_PATH", str(DEFAULT_DB)))
MAX_BODY_BYTES = 26 * 1024 * 1024
MAX_CSV_BYTES = 25 * 1024 * 1024
ALLOWED_ORIGINS = {
    "http://localhost:5173", "http://127.0.0.1:5173",
}
CONFIGURED_DEV_ORIGIN = os.environ.get("PARCELSENSE_DEV_ORIGIN")
if CONFIGURED_DEV_ORIGIN:
    parsed_dev_origin = urlsplit(CONFIGURED_DEV_ORIGIN)
    try:
        configured_port = parsed_dev_origin.port
    except ValueError as error:
        raise RuntimeError("PARCELSENSE_DEV_ORIGIN must be a valid loopback HTTP origin.") from error
    if (parsed_dev_origin.scheme != "http"
            or parsed_dev_origin.hostname not in {"localhost", "127.0.0.1"}
            or configured_port is None
            or parsed_dev_origin.username is not None
            or parsed_dev_origin.password is not None
            or parsed_dev_origin.path not in {"", "/"}
            or parsed_dev_origin.query
            or parsed_dev_origin.fragment):
        raise RuntimeError("PARCELSENSE_DEV_ORIGIN must be an exact loopback HTTP origin with a port.")
    ALLOWED_ORIGINS.add(f"http://{parsed_dev_origin.netloc}")
ALLOWED_ORIGINS_OF_DATA = {"synthetic", "unknown"}


def connect_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_db() -> None:
    with closing(connect_db()) as connection, connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                source_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                data_origin TEXT NOT NULL,
                session_ids_json TEXT NOT NULL,
                sample_count INTEGER NOT NULL,
                source_row_count INTEGER NOT NULL,
                issue_count INTEGER NOT NULL,
                csv_text TEXT NOT NULL
            )
        """)


def validate_csv(csv_text: str) -> tuple[list[str], int, int, int]:
    """Use the Phase 4 parser contract; return valid, source, issue counts."""
    try:
        reader = csv.reader(io.StringIO(csv_text, newline=""))
        headers = next(reader, [])
        if headers:
            headers[0] = headers[0].removeprefix("\ufeff")
        if len(headers) != len(set(headers)):
            raise ValueError("CSV header contains duplicate column names.")
        source_row_count = sum(1 for row in reader if any(value.strip() for value in row))
    except csv.Error as error:
        raise ValueError("CSV contains malformed quoting or delimiters.") from error
    with tempfile.TemporaryDirectory(prefix="parcelsense-api-") as directory:
        path = Path(directory) / "upload.csv"
        path.write_text(csv_text, encoding="utf-8", newline="")
        trials, exclusions = pipeline.read_trials(path)
    sample_count = sum(
        1 for trial in trials for record in trial.records
        if isinstance(record, pipeline.Sample)
    )
    issue_count = len(exclusions)
    session_ids = sorted({trial.session_id for trial in trials})
    if sample_count == 0:
        raise ValueError("CSV contains no valid motion samples.")
    return session_ids, sample_count, source_row_count, issue_count


class ApiHandler(BaseHTTPRequestHandler):
    server_version = "ParcelSenseLocalAPI/1.0"

    def log_message(self, format: str, *args: object) -> None:
        # Keep request logs useful without ever logging uploaded data.
        super().log_message(format, *args)

    def _send(self, status: int, body: bytes, content_type: str = "application/json; charset=utf-8",
              extra_headers: dict[str, str] | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        for name, value in (extra_headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status: int, payload: object) -> None:
        self._send(status, json.dumps(payload, ensure_ascii=False).encode("utf-8"))

    def _read_json(self) -> dict[str, object]:
        if not self.headers.get("Content-Type", "").lower().startswith("application/json"):
            raise ValueError("Content-Type must be application/json.")
        raw_length = self.headers.get("Content-Length", "")
        try:
            length = int(raw_length)
        except ValueError as error:
            raise ValueError("A valid Content-Length header is required.") from error
        if length < 1 or length > MAX_BODY_BYTES:
            raise ValueError("Request body must be between 1 byte and 26 MiB.")
        try:
            payload = json.loads(self.rfile.read(length))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ValueError("Request body must be valid UTF-8 JSON.") from error
        if not isinstance(payload, dict):
            raise ValueError("Request body must be a JSON object.")
        return payload

    def _origin_is_allowed(self) -> bool:
        origin = self.headers.get("Origin")
        return origin is None or origin in ALLOWED_ORIGINS

    def do_GET(self) -> None:  # noqa: N802
        if not self._origin_is_allowed():
            self._json(403, {"error": "This local API only accepts requests from the ParcelSense development app."})
            return
        path = urlsplit(self.path).path
        if path == "/api/health":
            self._json(200, {"status": "ok", "api_version": "1.0", "storage": "local SQLite"})
            return
        if path == "/api/demo.csv":
            csv_bytes = make_demo_csv().encode("utf-8")
            self._send(200, csv_bytes, "text/csv; charset=utf-8", {
                "Content-Disposition": 'attachment; filename="SYNTHETIC_DEMO_ONLY.csv"',
                "X-Data-Origin": "synthetic-demo-only",
            })
            return
        if path == "/api/sessions":
            with closing(connect_db()) as connection:
                rows = connection.execute("""
                    SELECT id, source_name, created_at, data_origin,
                           session_ids_json, sample_count, source_row_count, issue_count
                    FROM sessions ORDER BY created_at DESC
                """).fetchall()
            sessions = [{
                "id": row["id"], "source_name": row["source_name"],
                "created_at": row["created_at"], "data_origin": row["data_origin"],
                "session_ids": json.loads(row["session_ids_json"]),
                "sample_count": row["sample_count"],
                "source_row_count": row["source_row_count"],
                "issue_count": row["issue_count"],
            } for row in rows]
            self._json(200, {"sessions": sessions, "count": len(sessions)})
            return
        if path.startswith("/api/sessions/"):
            session_id = path.removeprefix("/api/sessions/")
            with closing(connect_db()) as connection:
                row = connection.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
            if row is None:
                self._json(404, {"error": "Session not found."})
            else:
                self._json(200, {
                    "id": row["id"], "source_name": row["source_name"],
                    "created_at": row["created_at"], "data_origin": row["data_origin"],
                    "session_ids": json.loads(row["session_ids_json"]),
                    "sample_count": row["sample_count"],
                    "source_row_count": row["source_row_count"],
                    "issue_count": row["issue_count"], "csv_text": row["csv_text"],
                })
            return
        self._json(404, {"error": "Route not found."})

    def do_POST(self) -> None:  # noqa: N802
        if not self._origin_is_allowed():
            self._json(403, {"error": "This local API only accepts requests from the ParcelSense development app."})
            return
        if urlsplit(self.path).path != "/api/sessions":
            self._json(404, {"error": "Route not found."})
            return
        try:
            payload = self._read_json()
            source_name = payload.get("source_name")
            csv_text = payload.get("csv_text")
            data_origin = payload.get("data_origin", "unknown")
            if not isinstance(source_name, str) or not source_name.strip() or len(source_name) > 180:
                raise ValueError("source_name must be a non-empty filename under 180 characters.")
            source_name = Path(source_name.replace("\\", "/")).name
            if not source_name:
                raise ValueError("source_name must include a filename.")
            if not isinstance(csv_text, str) or not csv_text.strip():
                raise ValueError("csv_text must contain a CSV file.")
            if len(csv_text.encode("utf-8")) > MAX_CSV_BYTES:
                raise ValueError("CSV files are limited to 25 MiB.")
            if not isinstance(data_origin, str) or data_origin not in ALLOWED_ORIGINS_OF_DATA:
                raise ValueError("data_origin must be synthetic or unknown.")
            session_ids, sample_count, source_row_count, issue_count = validate_csv(csv_text)
            if sample_count != source_row_count:
                raise ValueError("CSV contains invalid motion rows; only reviewed valid rows can be stored.")
        except (ValueError, TypeError) as error:
            self._json(400, {"error": str(error)})
            return
        session_id = secrets.token_urlsafe(12)
        created_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with closing(connect_db()) as connection, connection:
            connection.execute("""
                INSERT INTO sessions
                (id, source_name, created_at, data_origin, session_ids_json,
                 sample_count, source_row_count, issue_count, csv_text)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (session_id, source_name, created_at, data_origin,
                  json.dumps(session_ids), sample_count, source_row_count,
                  issue_count, csv_text))
        self._json(201, {
            "id": session_id, "source_name": source_name, "created_at": created_at,
            "data_origin": data_origin, "session_ids": session_ids,
            "sample_count": sample_count, "source_row_count": source_row_count,
            "issue_count": issue_count,
        })

    def do_DELETE(self) -> None:  # noqa: N802
        if not self._origin_is_allowed():
            self._json(403, {"error": "This local API only accepts requests from the ParcelSense development app."})
            return
        path = urlsplit(self.path).path
        prefix = "/api/sessions/"
        if not path.startswith(prefix) or not path.removeprefix(prefix):
            self._json(404, {"error": "Route not found."})
            return
        session_id = path.removeprefix(prefix)
        with closing(connect_db()) as connection, connection:
            cursor = connection.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            deleted = cursor.rowcount == 1
        if not deleted:
            self._json(404, {"error": "Session not found."})
            return
        self._json(200, {"deleted": True, "id": session_id})


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the local ParcelSense development API.")
    parser.add_argument("--port", type=int, default=8000)
    arguments = parser.parse_args()
    initialize_db()
    server = ThreadingHTTPServer(("127.0.0.1", arguments.port), ApiHandler)
    print(f"ParcelSense local API listening at http://127.0.0.1:{arguments.port}")
    print(f"SQLite database: {DB_PATH}")
    print("Press Ctrl+C to stop. The server is bound to loopback only.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
