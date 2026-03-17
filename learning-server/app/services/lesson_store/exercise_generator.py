from datetime import datetime, timezone
from typing import Any

from .s3 import sanitize_email


class LessonStoreExerciseGenerator:
    def _clear_exercise_generator(
        self,
        sanitized_email: str,
        lesson_id: str,
        lesson: dict[str, Any],
        next_mode: str | None = None,
    ) -> None:
        lesson.pop("exerciseGenerator", None)
        if next_mode is not None:
            lesson["exerciseMode"] = next_mode

    def put_exercise_generator(
        self, email: str, lesson_id: str, code: str
    ) -> dict[str, Any] | None:
        sanitized = sanitize_email(email)
        with self._lock:
            self._ensure_bucket()
            lesson = self.get(email, lesson_id)
            if lesson is None:
                return None
            now = datetime.now(timezone.utc).isoformat()
            sections = lesson.get("sections") or {}
            filename = sections.get("exercises") or self._section_filename("exercises")
            sections["exercises"] = filename
            lesson["sections"] = sections
            self._set_section_content(lesson, "exercises", code)
            meta_map = lesson.get("sectionsMeta") or {}
            meta = meta_map.get("exercises") or {}
            meta_payload = {
                "key": "exercises",
                "updatedAt": now,
                "version": int(meta.get("version", 0)) + 1,
                "contentLength": 0,
            }
            meta_map["exercises"] = meta_payload
            lesson["sectionsMeta"] = meta_map
            meta = {
                "updatedAt": now,
                "contentLength": len(code),
                "code": code,
            }
            lesson["exerciseGenerator"] = meta
            lesson["exerciseMode"] = "generator"
            lesson["updated_at"] = now
            lesson_key = self._lesson_key(sanitized, lesson_id)
            self._s3_client.put_object(
                Bucket=self._settings.s3_bucket,
                Key=lesson_key,
                Body=self._serialize_lesson(lesson),
                ContentType="application/json",
            )
            entries = self._load_index(sanitized)
            updated = False
            for entry in entries:
                if entry.get("id") == lesson_id:
                    entry["updated_at"] = now
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
                        "updated_at": now,
                    }
                )
            self._save_index(sanitized, entries)
            return meta

    def get_exercise_generator_meta(
        self, email: str, lesson_id: str
    ) -> dict[str, Any] | None:
        lesson = self.get(email, lesson_id)
        if not lesson:
            return None
        meta = lesson.get("exerciseGenerator")
        return meta if isinstance(meta, dict) else None

    def get_exercise_generator_meta_sanitized(
        self, sanitized_email: str, lesson_id: str
    ) -> dict[str, Any] | None:
        lesson = self.get_sanitized(sanitized_email, lesson_id)
        if not lesson:
            return None
        meta = lesson.get("exerciseGenerator")
        return meta if isinstance(meta, dict) else None

    def get_exercise_generator_sanitized(
        self, sanitized_email: str, lesson_id: str
    ) -> dict[str, Any] | None:
        lesson = self.get_sanitized(sanitized_email, lesson_id)
        if not lesson:
            return None
        meta = lesson.get("exerciseGenerator")
        if not isinstance(meta, dict):
            return None
        code = self._get_exercise_generator_code(lesson)
        if code is None:
            return None
        return {
            "content": code.encode("utf-8"),
            "contentType": "application/javascript",
            "meta": meta,
        }

    def _serialize_lesson(self, lesson: dict[str, Any]) -> bytes:
        import json

        return json.dumps(lesson, indent=2).encode("utf-8")
