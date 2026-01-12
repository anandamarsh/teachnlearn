import json
from datetime import datetime, timezone
from typing import Any

from botocore.exceptions import ClientError

from .s3 import sanitize_email


class LessonStoreSections:
    _HIDDEN_BASE_KEYS = {"samples", "references"}

    def _order_sections(self, sections: dict[str, str]) -> dict[str, str]:
        ordered: dict[str, str] = {}
        for base_key in self._settings.lesson_sections:
            matched = [
                key for key in sections if self._section_base_key(key) == base_key
            ]
            matched.sort(key=self._section_index)
            for key in matched:
                ordered[key] = sections[key]
        for key, value in sections.items():
            if key not in ordered:
                ordered[key] = value
        return ordered

    def _sync_ready_status(
        self, sanitized_email: str, lesson_id: str, lesson: dict[str, Any]
    ) -> None:
        status = str(lesson.get("status") or "").lower().strip()
        if "publish" in status or "active" in status:
            return
        sections = lesson.get("sections") or {}
        meta_map = lesson.get("sectionsMeta") or {}
        is_ready = False
        if sections:
            is_ready = True
            for key in sections:
                if self._section_base_key(key) in self._HIDDEN_BASE_KEYS:
                    continue
                meta = meta_map.get(key) or {}
                length = meta.get("contentLength")
                if length is None:
                    length = meta.get("content_length")
                if not isinstance(length, int) or length <= 0:
                    is_ready = False
                    break
        next_status = "ready" if is_ready else "draft"
        if status != next_status:
            lesson["status"] = next_status
        entries = self._load_index(sanitized_email)
        for entry in entries:
            if entry.get("id") == lesson_id:
                entry["status"] = lesson.get("status")
                entry["updated_at"] = lesson.get("updated_at")
                break
        self._save_index(sanitized_email, entries)
    def _initialize_sections(
        self, sanitized_email: str, lesson_id: str, sections: dict[str, str]
    ) -> None:
        for section_key, filename in sections.items():
            storage_key = self._section_key(sanitized_email, lesson_id, filename)
            self._s3_client.put_object(
                Bucket=self._settings.s3_bucket,
                Key=storage_key,
                Body=self._section_default_body(section_key),
                ContentType=self._section_content_type(section_key),
            )

    def get_sections_index(self, email: str, lesson_id: str) -> dict[str, Any] | None:
        lesson = self.get(email, lesson_id)
        if not lesson:
            return None
        sections = lesson.get("sections") or {}
        return {"sections": sections}

    def get_sections_index_sanitized(
        self, sanitized_email: str, lesson_id: str
    ) -> dict[str, Any] | None:
        lesson = self.get_sanitized(sanitized_email, lesson_id)
        if not lesson:
            return None
        sections = lesson.get("sections") or {}
        return {"sections": sections}

    def is_valid_section_key(self, section_key: str) -> bool:
        base_key = self._section_base_key(section_key)
        if base_key not in self._sections:
            return False
        if base_key == section_key:
            return True
        if not self._is_multi_section(base_key):
            return False
        return self._section_index(section_key) > 1

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
        if self._section_base_key(section_key) == "exercises":
            payload = json.loads(content) if content.strip() else []
            return {"key": section_key, "content": payload}
        return {"key": section_key, "contentHtml": content}

    def get_section_sanitized(
        self, sanitized_email: str, lesson_id: str, section_key: str
    ) -> dict[str, Any] | None:
        index = self.get_sections_index_sanitized(sanitized_email, lesson_id)
        if not index:
            return None
        filename = index.get("sections", {}).get(section_key)
        if not filename:
            return None
        key = self._section_key(sanitized_email, lesson_id, filename)
        try:
            obj = self._s3_client.get_object(Bucket=self._settings.s3_bucket, Key=key)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") == "NoSuchKey":
                return None
            raise
        content = obj["Body"].read().decode("utf-8")
        if self._section_base_key(section_key) == "exercises":
            payload = json.loads(content) if content.strip() else []
            return {"key": section_key, "content": payload}
        return {"key": section_key, "contentHtml": content}

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
        content_html: str,
        allow_create: bool,
    ) -> dict[str, Any] | None:
        sanitized = sanitize_email(email)
        lesson = self.get(email, lesson_id)
        if not lesson:
            return None
        sections = lesson.get("sections") or {}
        filename = sections.get(section_key)
        if not filename:
            if not allow_create:
                return None
            base_key = self._section_base_key(section_key)
            if base_key not in self._sections:
                return None
            if base_key != section_key and not self._is_multi_section(base_key):
                return None
            filename = self._section_filename(section_key)
            sections[section_key] = filename
            lesson["sections"] = self._order_sections(sections)
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
            Body=content_html.encode("utf-8"),
            ContentType=self._section_content_type(section_key),
        )
        now = datetime.now(timezone.utc).isoformat()
        meta_map = lesson.get("sectionsMeta") or {}
        meta = meta_map.get(section_key) or {}
        version = int(meta.get("version", 0)) + 1
        content_length = len(content_html.strip())
        meta_payload = {
            "key": section_key,
            "updatedAt": now,
            "version": version,
            "contentLength": content_length,
        }
        meta_map[section_key] = meta_payload
        lesson["sectionsMeta"] = meta_map
        lesson["updated_at"] = now
        if self._section_base_key(section_key) == "exercises":
            self._clear_exercise_generator(sanitized, lesson_id, lesson, next_mode="json")
        lesson["sections"] = self._order_sections(lesson.get("sections") or {})
        self._sync_ready_status(sanitized, lesson_id, lesson)
        lesson_key = self._lesson_key(sanitized, lesson_id)
        self._s3_client.put_object(
            Bucket=self._settings.s3_bucket,
            Key=lesson_key,
            Body=json.dumps(lesson, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        if self._section_base_key(section_key) == "exercises":
            payload = json.loads(content_html) if content_html.strip() else []
            return {"key": section_key, "content": payload}
        return {"key": section_key, "contentHtml": content_html}

    def create_section_instance(
        self,
        email: str,
        lesson_id: str,
        base_key: str,
        content_html: str,
    ) -> dict[str, Any] | None:
        sanitized = sanitize_email(email)
        if base_key not in self._sections or not self._is_multi_section(base_key):
            return None
        lesson = self.get(email, lesson_id)
        if not lesson:
            return None
        sections = lesson.get("sections") or {}
        candidates = [
            key for key in sections if self._section_base_key(key) == base_key
        ]
        next_index = 1
        if candidates:
            next_index = max(self._section_index(key) for key in candidates) + 1
        new_key = base_key if next_index == 1 else f"{base_key}-{next_index}"
        if new_key in sections:
            return None
        filename = self._section_filename(new_key)
        sections[new_key] = filename
        lesson["sections"] = self._order_sections(sections)
        key = self._section_key(sanitized, lesson_id, filename)
        self._s3_client.put_object(
            Bucket=self._settings.s3_bucket,
            Key=key,
            Body=content_html.encode("utf-8"),
            ContentType=self._section_content_type(new_key),
        )
        now = datetime.now(timezone.utc).isoformat()
        meta_map = lesson.get("sectionsMeta") or {}
        meta_payload = {
            "key": new_key,
            "updatedAt": now,
            "version": 1,
            "contentLength": len(content_html.strip()),
        }
        meta_map[new_key] = meta_payload
        lesson["sectionsMeta"] = meta_map
        lesson["updated_at"] = now
        if base_key == "exercises":
            self._clear_exercise_generator(sanitized, lesson_id, lesson, next_mode="json")
        lesson["sections"] = self._order_sections(lesson.get("sections") or {})
        self._sync_ready_status(sanitized, lesson_id, lesson)
        lesson_key = self._lesson_key(sanitized, lesson_id)
        self._s3_client.put_object(
            Bucket=self._settings.s3_bucket,
            Key=lesson_key,
            Body=json.dumps(lesson, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        if base_key == "exercises":
            payload = json.loads(content_html) if content_html.strip() else []
            return {"key": new_key, "content": payload}
        return {"key": new_key, "contentHtml": content_html}

    def append_exercises(
        self,
        email: str,
        lesson_id: str,
        items: list[dict[str, Any]],
        section_key: str = "exercises",
    ) -> dict[str, Any] | None:
        sanitized = sanitize_email(email)
        lesson = self.get(email, lesson_id)
        if not lesson:
            return None
        sections = lesson.get("sections") or {}
        base_key = self._section_base_key(section_key)
        if base_key != "exercises":
            return None
        filename = sections.get(section_key)
        if not filename:
            return None
        key = self._section_key(sanitized, lesson_id, filename)
        try:
            obj = self._s3_client.get_object(Bucket=self._settings.s3_bucket, Key=key)
            raw = obj["Body"].read().decode("utf-8")
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in ("NoSuchKey", "404"):
                raw = ""
            else:
                raise
        existing: list[Any]
        if raw.strip():
            payload = json.loads(raw)
            if not isinstance(payload, list):
                raise RuntimeError("exercises payload must be a JSON array")
            existing = payload
        else:
            existing = []
        existing.extend(items)
        updated_payload = json.dumps(existing, indent=2)
        self._s3_client.put_object(
            Bucket=self._settings.s3_bucket,
            Key=key,
            Body=updated_payload.encode("utf-8"),
            ContentType=self._section_content_type("exercises"),
        )
        now = datetime.now(timezone.utc).isoformat()
        meta_map = lesson.get("sectionsMeta") or {}
        meta = meta_map.get(section_key) or {}
        version = int(meta.get("version", 0)) + 1
        meta_payload = {
            "key": section_key,
            "updatedAt": now,
            "version": version,
            "contentLength": len(updated_payload.strip()),
        }
        meta_map[section_key] = meta_payload
        lesson["sectionsMeta"] = meta_map
        lesson["updated_at"] = now
        self._clear_exercise_generator(sanitized, lesson_id, lesson, next_mode="json")
        self._sync_ready_status(sanitized, lesson_id, lesson)
        lesson_key = self._lesson_key(sanitized, lesson_id)
        self._s3_client.put_object(
            Bucket=self._settings.s3_bucket,
            Key=lesson_key,
            Body=json.dumps(lesson, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        return {"key": section_key, "appended": len(items), "total": len(existing)}

    def delete_section(self, email: str, lesson_id: str, section_key: str) -> bool:
        sanitized = sanitize_email(email)
        lesson = self.get(email, lesson_id)
        if not lesson:
            return False
        sections = lesson.get("sections") or {}
        filename = sections.get(section_key)
        if not filename:
            return False
        storage_key = self._section_key(sanitized, lesson_id, filename)
        try:
            self._s3_client.delete_object(Bucket=self._settings.s3_bucket, Key=storage_key)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") not in ("NoSuchKey", "404"):
                raise
        sections.pop(section_key, None)
        lesson["sections"] = self._order_sections(sections)
        meta_map = lesson.get("sectionsMeta") or {}
        meta_map.pop(section_key, None)
        lesson["sectionsMeta"] = meta_map
        lesson["updated_at"] = datetime.now(timezone.utc).isoformat()
        self._sync_ready_status(sanitized, lesson_id, lesson)
        lesson_key = self._lesson_key(sanitized, lesson_id)
        self._s3_client.put_object(
            Bucket=self._settings.s3_bucket,
            Key=lesson_key,
            Body=json.dumps(lesson, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        return True
