import json
from datetime import datetime, timezone
from typing import Any

from botocore.exceptions import ClientError

from .s3 import sanitize_email


class LessonStoreExerciseGenerator:
    _EXERCISE_GENERATOR_FILENAME = "exercise.js"

    def _exercise_generator_filename(self) -> str:
        return self._EXERCISE_GENERATOR_FILENAME

    def _exercise_generator_key(
        self, sanitized_email: str, lesson_id: str, filename: str
    ) -> str:
        return self._section_key(sanitized_email, lesson_id, filename)

    def _clear_exercise_generator(
        self,
        sanitized_email: str,
        lesson_id: str,
        lesson: dict[str, Any],
        next_mode: str | None = None,
    ) -> None:
        meta = lesson.get("exerciseGenerator")
        if isinstance(meta, dict):
            filename = meta.get("filename")
            if not filename:
                filename = self._exercise_generator_filename()
            if filename:
                storage_key = self._exercise_generator_key(
                    sanitized_email, lesson_id, filename
                )
                try:
                    self._s3_client.delete_object(
                        Bucket=self._settings.s3_bucket,
                        Key=storage_key,
                    )
                except ClientError as exc:
                    if exc.response.get("Error", {}).get("Code") not in ("NoSuchKey", "404"):
                        raise
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
            existing = lesson.get("exerciseGenerator") or {}
            filename = self._exercise_generator_filename()
            existing_filename = existing.get("filename")
            if existing_filename and existing_filename != filename:
                self._clear_exercise_generator(sanitized, lesson_id, lesson)
            storage_key = self._exercise_generator_key(sanitized, lesson_id, filename)
            self._s3_client.put_object(
                Bucket=self._settings.s3_bucket,
                Key=storage_key,
                Body=code.encode("utf-8"),
                ContentType="application/javascript",
            )
            now = datetime.now(timezone.utc).isoformat()
            sections = lesson.get("sections") or {}
            sections["exercises"] = filename
            lesson["sections"] = sections
            exercises_filename = sections.get("exercises")
            if exercises_filename:
                exercises_key = self._section_key(
                    sanitized, lesson_id, exercises_filename
                )
                try:
                    self._s3_client.delete_object(
                        Bucket=self._settings.s3_bucket,
                        Key=exercises_key,
                    )
                except ClientError as exc:
                    if exc.response.get("Error", {}).get("Code") not in ("NoSuchKey", "404"):
                        raise
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
                "filename": filename,
                "contentLength": len(code),
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
        meta = self.get_exercise_generator_meta_sanitized(sanitized_email, lesson_id)
        if not meta:
            return None
        filename = meta.get("filename")
        if not filename:
            filename = self._exercise_generator_filename()
        storage_key = self._exercise_generator_key(sanitized_email, lesson_id, filename)
        try:
            obj = self._s3_client.get_object(
                Bucket=self._settings.s3_bucket,
                Key=storage_key,
            )
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in ("NoSuchKey", "404"):
                return None
            raise
        content = obj["Body"].read()
        content_type = obj.get("ContentType") or "application/javascript"
        return {
            "content": content,
            "contentType": content_type,
            "meta": meta,
        }

    def _serialize_lesson(self, lesson: dict[str, Any]) -> bytes:
        return json.dumps(lesson, indent=2).encode("utf-8")
