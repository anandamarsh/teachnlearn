import json
import secrets
import threading
from datetime import datetime, timezone
from typing import Any

import boto3
from botocore.exceptions import ClientError

from app.core.settings import Settings
from app.models.lesson import Lesson


def get_s3_client(settings: Settings) -> boto3.client:
    return boto3.client("s3", region_name=settings.aws_region)


def sanitize_email(email: str) -> str:
    email = email.strip().lower()
    sanitized: list[str] = []
    for ch in email:
        if ch.isalnum():
            sanitized.append(ch)
        elif ch == "@":
            sanitized.append("_at_")
        elif ch == ".":
            sanitized.append("_dot_")
        else:
            sanitized.append("_")
    return "".join(sanitized).strip("_")




def ensure_lesson_prefix(sanitized_email: str, lesson_id: str, settings: Settings) -> None:
    if not settings.s3_bucket:
        raise RuntimeError("S3 bucket not configured")
    s3_client = get_s3_client(settings)
    key = f"{settings.s3_prefix}/{sanitized_email}/lessons/{lesson_id}/"
    s3_client.put_object(Bucket=settings.s3_bucket, Key=key, Body=b"")


def delete_lesson_prefix(sanitized_email: str, lesson_id: str, settings: Settings) -> None:
    if not settings.s3_bucket:
        raise RuntimeError("S3 bucket not configured")
    s3_client = get_s3_client(settings)
    prefix = f"{settings.s3_prefix}/{sanitized_email}/lessons/{lesson_id}/"
    lesson_key = f"{prefix}index.json"
    # Best-effort deletes for common objects in the lesson folder.
    for key in (lesson_key, prefix):
        try:
            s3_client.delete_object(Bucket=settings.s3_bucket, Key=key)
        except ClientError:
            pass

    # Remove all versions/delete markers when bucket versioning is enabled.
    versions_paginator = s3_client.get_paginator("list_object_versions")
    version_items: list[dict[str, str]] = []
    for page in versions_paginator.paginate(Bucket=settings.s3_bucket, Prefix=prefix):
        for obj in page.get("Versions", []):
            version_items.append({"Key": obj["Key"], "VersionId": obj["VersionId"]})
        for marker in page.get("DeleteMarkers", []):
            version_items.append({"Key": marker["Key"], "VersionId": marker["VersionId"]})
    if version_items:
        s3_client.delete_objects(Bucket=settings.s3_bucket, Delete={"Objects": version_items})
        return

    paginator = s3_client.get_paginator("list_objects_v2")
    keys: list[dict[str, str]] = []
    for page in paginator.paginate(Bucket=settings.s3_bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            keys.append({"Key": obj["Key"]})
    if keys:
        s3_client.delete_objects(Bucket=settings.s3_bucket, Delete={"Objects": keys})


class LessonStore:
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

    def list_all(self, email: str) -> list[dict[str, Any]]:
        sanitized = sanitize_email(email)
        with self._lock:
            return self._load_index(sanitized)

    def list_by_status(self, email: str, status: str) -> list[dict[str, Any]]:
        sanitized = sanitize_email(email)
        with self._lock:
            return [entry for entry in self._load_index(sanitized) if entry.get("status") == status]

    def get(self, email: str, lesson_id: str) -> dict[str, Any] | None:
        sanitized = sanitize_email(email)
        key = self._lesson_key(sanitized, lesson_id)
        self._ensure_bucket()
        try:
            obj = self._s3_client.get_object(Bucket=self._settings.s3_bucket, Key=key)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") == "NoSuchKey":
                return None
            raise
        body = obj["Body"].read().decode("utf-8")
        return json.loads(body) if body else None

    def create(self, email: str, title: str, status: str, content: str | None) -> dict[str, Any]:
        sanitized = sanitize_email(email)
        now = datetime.now(timezone.utc).isoformat()
        with self._lock:
            self._ensure_bucket()
            entries = self._load_index(sanitized)
            lesson_id = self._generate_id(entries)
            sections = {key: f"{key}.md" for key in self._sections}
            sections_meta = {
                key: {"key": key, "updatedAt": now, "version": 1}
                for key in sections
            }
            lesson = Lesson(
                id=lesson_id,
                title=title,
                status=status,
                content=content,
                created_at=now,
                updated_at=now,
            )
            ensure_lesson_prefix(sanitized, lesson_id, self._settings)
            lesson_key = self._lesson_key(sanitized, lesson_id)
            lesson_payload = lesson.__dict__ | {"sections": sections, "sectionsMeta": sections_meta}
            self._s3_client.put_object(
                Bucket=self._settings.s3_bucket,
                Key=lesson_key,
                Body=json.dumps(lesson_payload, indent=2).encode("utf-8"),
                ContentType="application/json",
            )
            self._initialize_sections(sanitized, lesson_id, sections)
            entries.append(
                {
                    "id": lesson_id,
                    "title": title,
                    "status": status,
                    "updated_at": now,
                }
            )
            self._save_index(sanitized, entries)
        return lesson_payload

    def _initialize_sections(
        self, sanitized_email: str, lesson_id: str, sections: dict[str, str]
    ) -> None:
        for filename in sections.values():
            section_key = self._section_key(sanitized_email, lesson_id, filename)
            self._s3_client.put_object(
                Bucket=self._settings.s3_bucket,
                Key=section_key,
                Body=b"",
                ContentType="text/markdown",
            )

    def update(
        self,
        email: str,
        lesson_id: str,
        title: str | None,
        status: str | None,
        content: str | None,
    ) -> dict[str, Any] | None:
        sanitized = sanitize_email(email)
        with self._lock:
            self._ensure_bucket()
            lesson = self.get(email, lesson_id)
            if lesson is None:
                return None
            if title is not None:
                lesson["title"] = title
            if status is not None:
                lesson["status"] = status
            if content is not None:
                lesson["content"] = content
            lesson["updated_at"] = datetime.now(timezone.utc).isoformat()
            lesson_key = self._lesson_key(sanitized, lesson_id)
            self._s3_client.put_object(
                Bucket=self._settings.s3_bucket,
                Key=lesson_key,
                Body=json.dumps(lesson, indent=2).encode("utf-8"),
                ContentType="application/json",
            )
            entries = self._load_index(sanitized)
            updated = False
            for entry in entries:
                if entry.get("id") == lesson_id:
                    if title is not None:
                        entry["title"] = title
                    if status is not None:
                        entry["status"] = status
                    entry["updated_at"] = lesson["updated_at"]
                    updated = True
                    break
            if not updated:
                entries.append(
                    {
                        "id": lesson_id,
                        "title": lesson.get("title"),
                        "status": lesson.get("status"),
                        "updated_at": lesson["updated_at"],
                    }
                )
            self._save_index(sanitized, entries)
        return lesson

    def delete(self, email: str, lesson_id: str) -> bool:
        sanitized = sanitize_email(email)
        with self._lock:
            self._ensure_bucket()
            entries = self._load_index(sanitized)
            remaining = [entry for entry in entries if entry.get("id") != lesson_id]
            prefix = f"{self._settings.s3_prefix}/{sanitized}/lessons/{lesson_id}/"
            exists = False
            try:
                response = self._s3_client.list_objects_v2(
                    Bucket=self._settings.s3_bucket,
                    Prefix=prefix,
                    MaxKeys=1,
                )
                exists = bool(response.get("Contents"))
            except ClientError as exc:
                raise exc
            if len(remaining) == len(entries) and not exists:
                return False
            if len(remaining) != len(entries):
                self._save_index(sanitized, remaining)
            delete_lesson_prefix(sanitized, lesson_id, self._settings)
        return True

    def get_sections_index(self, email: str, lesson_id: str) -> dict[str, Any] | None:
        lesson = self.get(email, lesson_id)
        if not lesson:
            return None
        sections = lesson.get("sections") or {}
        return {"sections": sections}

    def is_valid_section_key(self, section_key: str) -> bool:
        return section_key in self._sections

    def get_section(self, email: str, lesson_id: str, section_key: str) -> dict[str, Any] | None:
        sanitized = sanitize_email(email)
        index = self.get_sections_index(email, lesson_id)
        if not index:
            return None
        filename = index.get("sections", {}).get(section_key)
        if not filename:
            return None
        key = self._section_key(sanitized, lesson_id, filename)
        try:
            obj = self._s3_client.get_object(Bucket=self._settings.s3_bucket, Key=key)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") == "NoSuchKey":
                return None
            raise
        content = obj["Body"].read().decode("utf-8")
        return {"key": section_key, "contentMd": content}

    def get_section_meta(self, email: str, lesson_id: str, section_key: str) -> dict[str, Any] | None:
        lesson = self.get(email, lesson_id)
        if not lesson:
            return None
        meta_map = lesson.get("sectionsMeta") or {}
        return meta_map.get(section_key)

    def put_section(
        self,
        email: str,
        lesson_id: str,
        section_key: str,
        content_md: str,
        allow_create: bool,
    ) -> dict[str, Any] | None:
        sanitized = sanitize_email(email)
        lesson = self.get(email, lesson_id)
        if not lesson:
            return None
        sections = lesson.get("sections") or {}
        filename = sections.get(section_key)
        if not filename:
            return None
        key = self._section_key(sanitized, lesson_id, filename)
        try:
            self._s3_client.head_object(Bucket=self._settings.s3_bucket, Key=key)
            exists = True
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") == "404":
                exists = False
            elif exc.response.get("Error", {}).get("Code") == "NoSuchKey":
                exists = False
            else:
                raise
        if not exists and not allow_create:
            return None
        self._s3_client.put_object(
            Bucket=self._settings.s3_bucket,
            Key=key,
            Body=content_md.encode("utf-8"),
            ContentType="text/markdown",
        )
        now = datetime.now(timezone.utc).isoformat()
        meta_map = lesson.get("sectionsMeta") or {}
        meta = meta_map.get(section_key) or {}
        version = int(meta.get("version", 0)) + 1
        meta_payload = {"key": section_key, "updatedAt": now, "version": version}
        meta_map[section_key] = meta_payload
        lesson["sectionsMeta"] = meta_map
        lesson["updated_at"] = now
        lesson_key = self._lesson_key(sanitized, lesson_id)
        self._s3_client.put_object(
            Bucket=self._settings.s3_bucket,
            Key=lesson_key,
            Body=json.dumps(lesson, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        return {"key": section_key, "contentMd": content_md}
