from __future__ import annotations

import csv
import http.client
import io
import json
import tempfile
import threading
import unittest
from contextlib import closing
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from backend import server as api
from backend.demo_data import make_demo_csv


class BackendApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp_dir = tempfile.TemporaryDirectory(prefix="parcelsense-api-test-")
        cls.original_db_path = api.DB_PATH
        api.DB_PATH = Path(cls.temp_dir.name) / "sessions.sqlite3"
        api.initialize_db()
        cls.httpd = api.ThreadingHTTPServer(("127.0.0.1", 0), api.ApiHandler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.host, cls.port = cls.httpd.server_address
        cls.base_url = f"http://{cls.host}:{cls.port}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join(timeout=2)
        api.DB_PATH = cls.original_db_path
        cls.temp_dir.cleanup()

    def setUp(self) -> None:
        with closing(api.connect_db()) as connection, connection:
            connection.execute("DELETE FROM sessions")

    def request(self, path: str, method: str = "GET", payload: object | None = None,
                headers: dict[str, str] | None = None) -> tuple[int, dict[str, str], bytes]:
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        request_headers = dict(headers or {})
        if body is not None:
            request_headers.setdefault("Content-Type", "application/json")
        request = Request(self.base_url + path, data=body, method=method, headers=request_headers)
        try:
            response = urlopen(request, timeout=5)
        except HTTPError as error:
            with error:
                return error.code, dict(error.headers.items()), error.read()
        with response:
            return response.status, dict(response.headers.items()), response.read()

    def upload_demo(self, data_origin: str = "synthetic") -> tuple[int, dict[str, object]]:
        status, _, body = self.request("/api/sessions", "POST", {
            "source_name": "../../SYNTHETIC_DEMO_ONLY.csv",
            "csv_text": make_demo_csv(),
            "data_origin": data_origin,
        }, {"Content-Type": "application/json"})
        return status, json.loads(body)

    def test_health_and_demo_csv_are_available_and_marked_synthetic(self) -> None:
        status, _, body = self.request("/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["status"], "ok")

        status, headers, body = self.request("/api/demo.csv")
        self.assertEqual(status, 200)
        normalized_headers = {name.lower(): value for name, value in headers.items()}
        self.assertEqual(normalized_headers["x-data-origin"], "synthetic-demo-only")
        self.assertIn("SYNTHETIC_DEMO_ONLY.csv", normalized_headers["content-disposition"])
        rows = list(csv.DictReader(body.decode("utf-8").splitlines()))
        self.assertEqual(len(rows), 1200)
        self.assertEqual({row["session_id"] for row in rows}, {"SYNTHETIC_DEMO_ONLY"})
        self.assertEqual({label: sum(row["label"] == label for row in rows) for label in ("Stable", "Normal Handling", "Rough Handling")}, {
            "Stable": 400, "Normal Handling": 400, "Rough Handling": 400,
        })
        self.assertEqual(api.validate_csv(body.decode("utf-8"))[1:], (1200, 1200, 0))

    def test_upload_persists_validated_copy_and_delete_removes_it(self) -> None:
        status, stored = self.upload_demo()
        self.assertEqual(status, 201)
        self.assertEqual(stored["source_name"], "SYNTHETIC_DEMO_ONLY.csv")
        self.assertEqual(stored["sample_count"], 1200)
        self.assertEqual(stored["data_origin"], "synthetic")

        status, _, body = self.request("/api/sessions")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["count"], 1)

        session_id = str(stored["id"])
        status, _, body = self.request(f"/api/sessions/{session_id}")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["csv_text"], make_demo_csv())

        status, _, body = self.request(f"/api/sessions/{session_id}", "DELETE")
        self.assertEqual(status, 200)
        self.assertTrue(json.loads(body)["deleted"])
        self.assertEqual(self.request(f"/api/sessions/{session_id}")[0], 404)

    def test_session_persists_across_api_restart(self) -> None:
        status, saved = self.upload_demo()
        self.assertEqual(status, 201)
        old_httpd = self.__class__.httpd
        old_thread = self.__class__.thread
        old_httpd.shutdown()
        old_httpd.server_close()
        old_thread.join(timeout=2)

        new_httpd = api.ThreadingHTTPServer(("127.0.0.1", 0), api.ApiHandler)
        new_thread = threading.Thread(target=new_httpd.serve_forever, daemon=True)
        new_thread.start()
        self.__class__.httpd = new_httpd
        self.__class__.thread = new_thread
        host, port = new_httpd.server_address
        self.__class__.base_url = f"http://{host}:{port}"

        status, _, body = self.request(f"/api/sessions/{saved['id']}")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["sample_count"], 1200)

    def test_rejects_invalid_csv_provenance_and_duplicate_headers(self) -> None:
        status, _, body = self.request("/api/sessions", "POST", {
            "source_name": "bad.csv", "csv_text": "x,y\n1,2\n", "data_origin": "unknown",
        })
        self.assertEqual(status, 400)
        self.assertIn("missing required CSV columns", json.loads(body)["error"])

        status, _, body = self.request("/api/sessions", "POST", {
            "source_name": "demo.csv", "csv_text": make_demo_csv(), "data_origin": "board_capture",
        })
        self.assertEqual(status, 400)
        self.assertIn("data_origin", json.loads(body)["error"])

        duplicate_header_csv = make_demo_csv().replace("schema_version,session_id", "schema_version,schema_version", 1)
        status, _, body = self.request("/api/sessions", "POST", {
            "source_name": "duplicate.csv", "csv_text": duplicate_header_csv, "data_origin": "unknown",
        })
        self.assertEqual(status, 400)
        self.assertIn("duplicate column", json.loads(body)["error"])

    def test_rejects_cross_origin_browser_requests(self) -> None:
        status, _, body = self.request("/api/health", headers={"Origin": "https://example.invalid"})
        self.assertEqual(status, 403)
        self.assertIn("local API", json.loads(body)["error"])

        status, _, body = self.request("/api/health", headers={"Origin": "http://localhost:5173"})
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["status"], "ok")

    def test_rejects_partially_invalid_uploads(self) -> None:
        rows = list(csv.reader(make_demo_csv().splitlines()))
        status_index = rows[0].index("status")
        rows[1][status_index] = "sensor_error"
        output = io.StringIO(newline="")
        csv.writer(output, lineterminator="\r\n").writerows(rows)
        status, _, body = self.request("/api/sessions", "POST", {
            "source_name": "partially-invalid.csv",
            "csv_text": output.getvalue(),
            "data_origin": "synthetic",
        })
        self.assertEqual(status, 400)
        self.assertIn("only reviewed valid rows", json.loads(body)["error"])

    def test_rejects_oversized_request_before_reading_body(self) -> None:
        connection = http.client.HTTPConnection(self.host, self.port, timeout=5)
        try:
            connection.putrequest("POST", "/api/sessions")
            connection.putheader("Content-Length", str(api.MAX_BODY_BYTES + 1))
            connection.putheader("Content-Type", "application/json")
            connection.endheaders()
            response = connection.getresponse()
            self.assertEqual(response.status, 400)
            self.assertIn("26 MiB", json.loads(response.read())["error"])
        finally:
            connection.close()


if __name__ == "__main__":
    unittest.main()
