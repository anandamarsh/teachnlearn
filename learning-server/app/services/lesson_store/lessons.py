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

    def list_all_sanitized(self, sanitized_email: str) -> list[dict[str, Any]]:
        with self._lock:
            return self._load_index(sanitized_email)

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

    def get_sanitized(self, sanitized_email: str, lesson_id: str) -> dict[str, Any] | None:
        key = self._lesson_key(sanitized_email, lesson_id)
        self._ensure_bucket()
        try:
            obj = self._s3_client.get_object(Bucket=self._settings.s3_bucket, Key=key)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") == "NoSuchKey":
                return None
            raise
        body = obj["Body"].read().decode("utf-8")
        return json.loads(body) if body else None

    def list_published_catalog(self) -> list[dict[str, Any]]:
        entries: list[dict[str, Any]] = []
        for account in self.list_account_prefixes():
            for lesson in self.list_all_sanitized(account):
                status = str(lesson.get("status", "")).strip().lower()
                if status != "published":
                    continue
                payload = dict(lesson)
                lesson_id = str(lesson.get("id") or "").strip()
                if lesson_id:
                    full = self.get_sanitized(account, lesson_id)
                    if full:
                        payload["summary"] = full.get("summary") or full.get("content")
                        if "subject" in full:
                            payload["subject"] = full.get("subject")
                        if "level" in full:
                            payload["level"] = full.get("level")
                        if "requires_login" in full:
                            payload["requires_login"] = full.get("requires_login")
                        if "exerciseConfig" in full:
                            payload["exerciseConfig"] = full.get("exerciseConfig")
                        if "exerciseGenerator" in full:
                            payload["exerciseGenerator"] = full.get("exerciseGenerator")
                        if "exerciseMode" in full:
                            payload["exerciseMode"] = full.get("exerciseMode")
                payload["teacher"] = account
                entries.append(payload)
        entries.sort(key=lambda item: item.get("updated_at", ""), reverse=True)
        return entries

    def create(
        self,
        email: str,
        title: str,
        status: str,
        summary: str | None,
        subject: str | None = None,
        level: str | None = None,
        requires_login: bool | None = None,
        exercise_config: dict[str, int] | None = None,
    ) -> dict[str, Any]:
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
                subject=subject,
                level=level,
                requires_login=requires_login,
                summary=summary,
                exercise_config=exercise_config,
                created_at=now,
                updated_at=now,
            )
            ensure_lesson_prefix(sanitized, lesson_id, self._settings)
            lesson_key = self._lesson_key(sanitized, lesson_id)
            lesson_payload = lesson.__dict__ | {"sections": sections, "sectionsMeta": sections_meta}
            exercise_config_value = lesson_payload.pop("exercise_config", None)
            if exercise_config_value is not None:
                lesson_payload["exerciseConfig"] = exercise_config_value
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
                    "subject": subject,
                    "level": level,
                    "requires_login": requires_login,
                    "exerciseConfig": exercise_config,
                    "updated_at": now,
                }
            )
            self._save_index(sanitized, entries)
        return lesson_payload

    def put_icon(
        self,
        email: str,
        lesson_id: str,
        payload: bytes,
        content_type: str,
        extension: str,
    ) -> str:
        sanitized = sanitize_email(email)
        self._ensure_bucket()
        key = self._icon_key(sanitized, lesson_id, extension)
        self._s3_client.put_object(
            Bucket=self._settings.s3_bucket,
            Key=key,
            Body=payload,
            ContentType=content_type,
        )
        return key

    def update_icon_url(self, email: str, lesson_id: str, icon_url: str) -> bool:
        sanitized = sanitize_email(email)
        now = datetime.now(timezone.utc).isoformat()
        with self._lock:
            self._ensure_bucket()
            lesson = self.get(email, lesson_id)
            if lesson is None:
                return False
            lesson["iconUrl"] = icon_url
            lesson["updated_at"] = now
            lesson_key = self._lesson_key(sanitized, lesson_id)
            self._s3_client.put_object(
                Bucket=self._settings.s3_bucket,
                Key=lesson_key,
                Body=json.dumps(lesson, indent=2).encode("utf-8"),
                ContentType="application/json",
            )
            entries = self._load_index(sanitized)
            for entry in entries:
                if entry.get("id") == lesson_id:
                    entry["iconUrl"] = icon_url
                    entry["updated_at"] = now
                    break
            self._save_index(sanitized, entries)
        return True

    def update(
        self,
        email: str,
        lesson_id: str,
        title: str | None,
        status: str | None,
        summary: str | None,
        subject: str | None,
        level: str | None,
        requires_login: bool | None,
        exercise_config: dict[str, int] | None,
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
            if summary is not None:
                lesson["summary"] = summary
                lesson.pop("content", None)
            if subject is not None:
                lesson["subject"] = subject
            if level is not None:
                lesson["level"] = level
            if requires_login is not None:
                lesson["requires_login"] = requires_login
            if exercise_config is not None:
                lesson["exerciseConfig"] = exercise_config
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
                    if subject is not None:
                        entry["subject"] = subject
                    if level is not None:
                        entry["level"] = level
                    if requires_login is not None:
                        entry["requires_login"] = requires_login
                    if exercise_config is not None:
                        entry["exerciseConfig"] = exercise_config
                    entry["updated_at"] = lesson["updated_at"]
                    updated = True
                    break
            if not updated:
                entries.append(
                    {
                        "id": lesson_id,
                        "title": lesson.get("title"),
                        "status": lesson.get("status"),
                        "subject": lesson.get("subject"),
                        "level": lesson.get("level"),
                        "requires_login": lesson.get("requires_login"),
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
            subject = lesson.get("subject")
            level = lesson.get("level")
            icon_url = lesson.get("iconUrl")
            requires_login = lesson.get("requires_login")
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
                "summary": lesson.get("summary") or lesson.get("content"),
                "subject": subject,
                "level": level,
                "requires_login": requires_login,
                "iconUrl": icon_url,
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
                    "subject": subject,
                    "level": level,
                    "requires_login": requires_login,
                    "iconUrl": icon_url,
                    "updated_at": now,
                }
            )
            self._save_index(sanitized, entries)
        return lesson_payload
