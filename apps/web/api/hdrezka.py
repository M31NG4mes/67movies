"""Vercel Python Serverless Function entrypoint for /api/hdrezka."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from _hdrezka_service import (
    HdRezkaServiceError,
    get_details,
    get_streams,
    search_content,
)


def _first_param(qs: dict, name: str) -> str | None:
    vals = qs.get(name)
    if not vals:
        return None
    val = vals[0].strip()
    return val if val else None


def _int_param(qs: dict, name: str) -> int | None:
    raw = _first_param(qs, name)
    if raw is None:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        action = (_first_param(qs, "action") or "search").lower()

        try:
            if action == "search":
                q = _first_param(qs, "q") or ""
                page = _int_param(qs, "page") or 1
                data = search_content(q, page=max(1, page))
                self._send_json(200, data)
                return

            if action == "details":
                url = _first_param(qs, "url") or ""
                force = _first_param(qs, "force") == "1"
                data = get_details(url, force_refresh=force)
                self._send_json(200, data)
                return

            if action in ("streams", "resolve"):
                data = get_streams(
                    url=_first_param(qs, "url"),
                    title=_first_param(qs, "title"),
                    original_title=_first_param(qs, "originalTitle"),
                    year=_int_param(qs, "year"),
                    media_type=_first_param(qs, "type"),
                    season=_int_param(qs, "season"),
                    episode=_int_param(qs, "episode"),
                    translator_id=_int_param(qs, "translatorId"),
                    force_refresh=_first_param(qs, "force") == "1",
                )
                self._send_json(200, data)
                return

            self._send_json(400, {"error": "BAD_ACTION", "message": f"Неизвестное действие: {action}"})
        except HdRezkaServiceError as err:
            self._send_json(err.status, {"error": err.code, "message": err.message})
        except Exception as err:
            self._send_json(500, {"error": "INTERNAL_ERROR", "message": str(err)})
