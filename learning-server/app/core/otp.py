import random
import re
import threading
import time

from app.core.settings import Settings


class OtpStore:
    def __init__(self, ttl_seconds: int = 600) -> None:
        self._ttl_seconds = ttl_seconds
        self._lock = threading.Lock()
        self._store: dict[str, tuple[str, float]] = {}

    @property
    def ttl_seconds(self) -> int:
        return self._ttl_seconds

    @ttl_seconds.setter
    def ttl_seconds(self, value: int) -> None:
        self._ttl_seconds = max(60, int(value))

    def _normalize_email(self, email: str) -> str:
        return email.strip().lower()

    def _normalize_code(self, code: str) -> str:
        return re.sub(r"\D", "", code or "")

    def generate(self, email: str) -> str:
        normalized = self._normalize_email(email)
        raw = f"{random.randint(0, 999999):06d}"
        expires_at = time.time() + self._ttl_seconds
        with self._lock:
            self._store[normalized] = (raw, expires_at)
        return raw

    def verify(self, email: str, code: str) -> bool:
        normalized = self._normalize_email(email)
        normalized_code = self._normalize_code(code)
        if not normalized_code:
            return False
        with self._lock:
            stored = self._store.get(normalized)
            if not stored:
                return False
            expected, expires_at = stored
            if time.time() > expires_at:
                self._store.pop(normalized, None)
                return False
            return expected == normalized_code


_store = OtpStore()


def _sync_ttl(settings: Settings) -> None:
    if settings.otp_ttl_seconds and _store.ttl_seconds != settings.otp_ttl_seconds:
        _store.ttl_seconds = settings.otp_ttl_seconds


def generate_otp(email: str, settings: Settings) -> str:
    _sync_ttl(settings)
    return _store.generate(email)


def verify_otp(email: str, code: str, settings: Settings) -> bool:
    _sync_ttl(settings)
    return _store.verify(email, code)
