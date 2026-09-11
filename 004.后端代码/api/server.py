"""Minimal HTTP/SSE boundary for the chat service."""

from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.chat_service import chat  # noqa: E402
from core.config import AppConfig  # noqa: E402


class Handler(BaseHTTPRequestHandler):
    def _headers(self, status: int, content_type: str = "application/json; charset=utf-8") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

    def _json(self, status: int, body: dict) -> None:
        self._headers(status)
        self.wfile.write(json.dumps(body, ensure_ascii=False).encode("utf-8"))

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        self._json(200, {"status": "ok"}) if self.path == "/health" else self._json(404, {"error": "Not Found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/api/chat":
            return self._json(404, {"error": "Not Found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 1024 * 1024:
                raise ValueError("请求体过大")
            body = json.loads(self.rfile.read(length) or b"{}")
            stream = body.get("stream") is True
            upstream = chat(body, stream=stream)
            if stream:
                self._headers(200, "text/event-stream; charset=utf-8")
                with upstream:
                    while chunk := upstream.read(8192):
                        self.wfile.write(chunk)
                        self.wfile.flush()
            else:
                self._json(200, upstream)
        except Exception as error:
            self._json(502, {"error": str(error) or "LLM 请求失败"})


if __name__ == "__main__":
    port = AppConfig.from_env().port
    print(f"医小知 API 已启动：http://127.0.0.1:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
