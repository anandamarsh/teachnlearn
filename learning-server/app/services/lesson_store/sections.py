import json
from datetime import datetime, timezone
from typing import Any

from botocore.exceptions import ClientError

from .s3 import sanitize_email


class LessonStoreSections:
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
        lesson_key = self._lesson_key(sanitized, lesson_id)
        self._s3_client.put_object(
            Bucket=self._settings.s3_bucket,
            Key=lesson_key,
            Body=json.dumps(lesson, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        return {"key": section_key, "contentHtml": content_html}
