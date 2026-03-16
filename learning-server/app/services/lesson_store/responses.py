import json
import re
from datetime import datetime, timezone
from typing import Any

from botocore.exceptions import ClientError


def _sanitize_path_segment(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "_", str(value or "").strip().lower())
    return cleaned.strip("._-") or "item"


class LessonStoreResponses:
    def _response_prefix(
        self,
        sanitized_email: str,
        lesson_id: str,
        student_name: str,
        section_key: str,
    ) -> str:
        student_key = _sanitize_path_segment(student_name)
        section_segment = _sanitize_path_segment(section_key)
        return (
            f"{self._settings.s3_prefix}/{sanitized_email}/lessons/{lesson_id}/"
            f"responses/{student_key}/{section_segment}"
        )

    def _response_json_key(
        self,
        sanitized_email: str,
        lesson_id: str,
        student_name: str,
        section_key: str,
    ) -> str:
        return (
            f"{self._response_prefix(sanitized_email, lesson_id, student_name, section_key)}/"
            "responses.json"
        )

    def get_student_responses_sanitized(
        self,
        sanitized_email: str,
        lesson_id: str,
        student_name: str,
        section_key: str,
    ) -> dict[str, Any]:
        self._ensure_bucket()
        key = self._response_json_key(sanitized_email, lesson_id, student_name, section_key)
        try:
            obj = self._s3_client.get_object(Bucket=self._settings.s3_bucket, Key=key)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in {"NoSuchKey", "404"}:
                return {"responses": [], "updatedAt": None}
            raise
        body = obj["Body"].read().decode("utf-8")
        if not body:
            return {"responses": [], "updatedAt": None}
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            return {"responses": [], "updatedAt": None}
        if not isinstance(payload, dict):
            return {"responses": [], "updatedAt": None}
        responses = payload.get("responses")
        if not isinstance(responses, list):
            responses = []
        return {
            "responses": responses,
            "updatedAt": payload.get("updatedAt"),
        }

    def list_lesson_response_documents_sanitized(
        self,
        sanitized_email: str,
        lesson_id: str,
    ) -> list[dict[str, str]]:
        self._ensure_bucket()
        prefix = (
            f"{self._settings.s3_prefix}/{sanitized_email}/lessons/{lesson_id}/responses/"
        )
        paginator = self._s3_client.get_paginator("list_objects_v2")
        documents: list[dict[str, str]] = []
        pattern = re.compile(
            rf"^{re.escape(prefix)}(?P<student>[^/]+)/(?P<section>[^/]+)/responses\.json$"
        )
        for page in paginator.paginate(
            Bucket=self._settings.s3_bucket,
            Prefix=prefix,
        ):
            for item in page.get("Contents", []):
                key = str(item.get("Key") or "")
                match = pattern.match(key)
                if not match:
                    continue
                documents.append(
                    {
                        "studentKey": match.group("student"),
                        "sectionKey": match.group("section"),
                        "storageKey": key,
                    }
                )
        return documents

    def put_student_responses_sanitized(
        self,
        sanitized_email: str,
        lesson_id: str,
        student_name: str,
        section_key: str,
        responses: list[dict[str, Any]],
        removed_storage_keys: list[str],
        new_files: list[dict[str, Any]],
    ) -> dict[str, Any]:
        self._ensure_bucket()
        prefix = self._response_prefix(sanitized_email, lesson_id, student_name, section_key)
        for storage_key in removed_storage_keys:
            if not storage_key.startswith(prefix):
                continue
            try:
                self._s3_client.delete_object(
                    Bucket=self._settings.s3_bucket,
                    Key=storage_key,
                )
            except ClientError:
                pass

        for file_payload in new_files:
            self._s3_client.put_object(
                Bucket=self._settings.s3_bucket,
                Key=file_payload["storageKey"],
                Body=file_payload["content"],
                ContentType=file_payload["contentType"],
            )

        updated_at = datetime.now(timezone.utc).isoformat()
        payload = {
            "updatedAt": updated_at,
            "responses": responses,
        }
        self._s3_client.put_object(
            Bucket=self._settings.s3_bucket,
            Key=self._response_json_key(
                sanitized_email, lesson_id, student_name, section_key
            ),
            Body=json.dumps(payload, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        return payload
