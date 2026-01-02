import json
from datetime import datetime, timezone
from typing import Any

from botocore.exceptions import ClientError

from app.models.lesson import Lesson

from .s3 import delete_lesson_prefix, ensure_lesson_prefix, sanitize_email


class LessonStoreLessons:
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
            sections = {key: self._section_filename(key) for key in self._sections}
            sections_meta = {}
            for key in sections:
                default_body = self._section_default_body(key)
                sections_meta[key] = {
                    "key": key,
                    "updatedAt": now,
                    "version": 1,
                    "contentLength": len(default_body.strip()),
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

    def duplicate(self, email: str, lesson_id: str) -> dict[str, Any] | None:
        sanitized = sanitize_email(email)
        with self._lock:
            self._ensure_bucket()
            lesson = self.get(email, lesson_id)
            if lesson is None:
                return None
            entries = self._load_index(sanitized)
            new_id = self._generate_id(entries)
            now = datetime.now(timezone.utc).isoformat()
            title = lesson.get("title") or "Untitled lesson"
            if not str(title).lower().endswith("(copy)"):
                title = f"{title} (Copy)"
            sections = lesson.get("sections") or {
                key: self._section_filename(key) for key in self._sections
            }
            sections_meta = {
                key: {"key": key, "updatedAt": now, "version": 1}
                for key in sections
            }
            ensure_lesson_prefix(sanitized, new_id, self._settings)
            lesson_payload = {
                "id": new_id,
                "title": title,
                "status": "draft",
                "content": lesson.get("content"),
                "created_at": now,
                "updated_at": now,
                "sections": sections,
                "sectionsMeta": sections_meta,
            }
            lesson_key = self._lesson_key(sanitized, new_id)
            self._s3_client.put_object(
                Bucket=self._settings.s3_bucket,
                Key=lesson_key,
                Body=json.dumps(lesson_payload, indent=2).encode("utf-8"),
                ContentType="application/json",
            )
            for key, filename in sections.items():
                source_key = self._section_key(sanitized, lesson_id, filename)
                dest_key = self._section_key(sanitized, new_id, filename)
                try:
                    self._s3_client.copy_object(
                        Bucket=self._settings.s3_bucket,
                        CopySource={"Bucket": self._settings.s3_bucket, "Key": source_key},
                        Key=dest_key,
                        ContentType=self._section_content_type(key),
                    )
                except ClientError as exc:
                    if exc.response.get("Error", {}).get("Code") in ("NoSuchKey", "404"):
                        self._s3_client.put_object(
                            Bucket=self._settings.s3_bucket,
                            Key=dest_key,
                            Body=self._section_default_body(key),
                            ContentType=self._section_content_type(key),
                        )
                    else:
                        raise
            entries.append(
                {
                    "id": new_id,
                    "title": title,
                    "status": "draft",
                    "updated_at": now,
                }
            )
            self._save_index(sanitized, entries)
        return lesson_payload
