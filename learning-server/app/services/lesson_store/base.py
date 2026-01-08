import json
import secrets
import threading
from typing import Any

from botocore.exceptions import ClientError

from app.core.settings import Settings

from .s3 import get_s3_client, sanitize_email


class LessonStoreBase:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._lock = threading.Lock()
        self._s3_client = get_s3_client(settings)
        self._sections = settings.lesson_sections

    def _ensure_bucket(self) -> None:
        if not self._settings.s3_bucket:
            raise RuntimeError("S3 bucket not configured")

    def _index_key(self, sanitized_email: str) -> str:
        return f"{self._settings.s3_prefix}/{sanitized_email}/lessons/_meta/index.json"

    def _lesson_key(self, sanitized_email: str, lesson_id: str) -> str:
        return f"{self._settings.s3_prefix}/{sanitized_email}/lessons/{lesson_id}/index.json"

    def _section_key(self, sanitized_email: str, lesson_id: str, filename: str) -> str:
        return f"{self._settings.s3_prefix}/{sanitized_email}/lessons/{lesson_id}/{filename}"

    def _section_base_key(self, section_key: str) -> str:
        if "-" in section_key:
            base, suffix = section_key.rsplit("-", 1)
            if suffix.isdigit():
                return base
        return section_key

    def _section_index(self, section_key: str) -> int:
        if "-" in section_key:
            base, suffix = section_key.rsplit("-", 1)
            if suffix.isdigit():
                return int(suffix)
            return 1
        return 1

    def _is_multi_section(self, section_key: str) -> bool:
        return section_key in {"lesson", "exercises"}

    def _section_filename(self, section_key: str) -> str:
        base_key = self._section_base_key(section_key)
        extension = "json" if base_key == "exercises" else "html"
        return f"{section_key}.{extension}"

    def _section_content_type(self, section_key: str) -> str:
        return (
            "application/json"
            if self._section_base_key(section_key) == "exercises"
            else "text/html"
        )

    def _section_default_body(self, section_key: str) -> bytes:
        return b"[]" if self._section_base_key(section_key) == "exercises" else b""

    def _icon_key(self, sanitized_email: str, lesson_id: str, extension: str) -> str:
        safe_extension = extension.lstrip(".").lower()
        return (
            f"{self._settings.s3_prefix}/{sanitized_email}/lessons/_meta/"
            f"icon_{lesson_id}.{safe_extension}"
        )

    def icon_key(self, email: str, lesson_id: str, extension: str) -> str:
        sanitized = sanitize_email(email)
        return self._icon_key(sanitized, lesson_id, extension)

    def _report_key(self, sanitized_email: str, lesson_id: str) -> str:
        return (
            f"{self._settings.s3_prefix}/{sanitized_email}/lessons/{lesson_id}/public-lesson.html"
        )

    def report_key(self, email: str, lesson_id: str) -> str:
        sanitized = sanitize_email(email)
        return self._report_key(sanitized, lesson_id)

    def _load_index(self, sanitized_email: str) -> list[dict[str, Any]]:
        self._ensure_bucket()
        key = self._index_key(sanitized_email)
        try:
            obj = self._s3_client.get_object(Bucket=self._settings.s3_bucket, Key=key)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") == "NoSuchKey":
                return []
            raise
        body = obj["Body"].read().decode("utf-8")
        payload = json.loads(body) if body else {}
        return payload.get("lessons", [])

    def _save_index(self, sanitized_email: str, entries: list[dict[str, Any]]) -> None:
        self._ensure_bucket()
        key = self._index_key(sanitized_email)
        payload = json.dumps({"lessons": entries}, indent=2)
        self._s3_client.put_object(
            Bucket=self._settings.s3_bucket,
            Key=key,
            Body=payload.encode("utf-8"),
            ContentType="application/json",
        )

    def _generate_id(self, entries: list[dict[str, Any]]) -> str:
        existing = {entry.get("id") for entry in entries}
        for _ in range(100):
            candidate = f"{secrets.randbelow(1_000_000):06d}"
            if candidate not in existing:
                return candidate
        raise RuntimeError("Unable to generate unique lesson id")

    def list_account_prefixes(self) -> list[str]:
        self._ensure_bucket()
        prefix = f"{self._settings.s3_prefix}/"
        paginator = self._s3_client.get_paginator("list_objects_v2")
        accounts: list[str] = []
        for page in paginator.paginate(
            Bucket=self._settings.s3_bucket,
            Prefix=prefix,
            Delimiter="/",
        ):
            for entry in page.get("CommonPrefixes", []):
                key_prefix = str(entry.get("Prefix", ""))
                if not key_prefix.startswith(prefix):
                    continue
                account = key_prefix[len(prefix) :].strip("/")
                if account:
                    accounts.append(account)
        return accounts
