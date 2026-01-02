import hashlib
import json
import threading
import time
from typing import Any


def cache_key(tool: str, email: str, payload: dict[str, Any]) -> str:
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    return f"{tool}:{email}:{digest}"


def log_params(tool: str, params: dict[str, Any]) -> None:
    def scrub(value: Any) -> Any:
        if isinstance(value, str) and len(value) > 20:
            return f"{value[:20]}..."
        return value

    sanitized = {key: scrub(value) for key, value in params.items()}
    payload = json.dumps(sanitized, separators=(",", ":"))
    print(f"[DEBUG] [MCP] {tool} params={payload}")


class DebounceGate:
    def __init__(self, delay_seconds: float = 1.0) -> None:
        self._delay = delay_seconds
        self._lock = threading.Lock()
        self._latest: dict[str, float] = {}

    def should_run(self, key: str) -> bool:
        token = time.monotonic()
        with self._lock:
            self._latest[key] = token
        time.sleep(self._delay)
        with self._lock:
            return self._latest.get(key) == token

    def mark_ignored(self, tool: str, key: str) -> None:
        print(f"[DEBUG] [MCP] debounced tool={tool} key={key}")


class RecentResultCache:
    def __init__(self, ttl_seconds: float = 60.0) -> None:
        self._ttl = ttl_seconds
        self._lock = threading.Lock()
        self._entries: dict[str, tuple[float, dict[str, Any]]] = {}

    def _purge(self) -> None:
        now = time.monotonic()
        expired = [key for key, (ts, _) in self._entries.items() if now - ts > self._ttl]
        for key in expired:
            self._entries.pop(key, None)

    def get(self, key: str) -> dict[str, Any] | None:
        with self._lock:
            self._purge()
            entry = self._entries.get(key)
            return entry[1] if entry else None

    def set(self, key: str, payload: dict[str, Any]) -> None:
        with self._lock:
            self._purge()
            self._entries[key] = (time.monotonic(), payload)


DEBOUNCE = DebounceGate(delay_seconds=1.0)
RESULT_CACHE = RecentResultCache(ttl_seconds=60.0)
