import json
from typing import Any

from botocore.exceptions import ClientError

from .s3 import sanitize_email


class LessonStoreProfile:
    def _profile_key(self, sanitized_email: str) -> str:
        return f"{self._settings.s3_prefix}/{sanitized_email}/teacher.json"

    def _students_key(self, sanitized_email: str) -> str:
        return f"{self._settings.s3_prefix}/{sanitized_email}/students/students.json"

    def get_profile(self, email: str) -> dict[str, Any]:
        sanitized = sanitize_email(email)
        return self.get_profile_sanitized(sanitized)

    def get_profile_sanitized(self, sanitized_email: str) -> dict[str, Any]:
        self._ensure_bucket()
        key = self._profile_key(sanitized_email)
        try:
            obj = self._s3_client.get_object(Bucket=self._settings.s3_bucket, Key=key)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") == "NoSuchKey":
                return {"name": "", "school": ""}
            raise
        body = obj["Body"].read().decode("utf-8")
        if not body:
            return {"name": "", "school": ""}
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            return {"name": "", "school": ""}
        if not isinstance(payload, dict):
            return {"name": "", "school": ""}
        return {
            "name": str(payload.get("name") or ""),
            "school": str(payload.get("school") or ""),
        }

    def put_profile(self, email: str, name: str | None, school: str | None) -> dict[str, Any]:
        sanitized = sanitize_email(email)
        return self.put_profile_sanitized(sanitized, name, school)

    def put_profile_sanitized(
        self, sanitized_email: str, name: str | None, school: str | None
    ) -> dict[str, Any]:
        self._ensure_bucket()
        key = self._profile_key(sanitized_email)
        payload = {
            "name": str(name or ""),
            "school": str(school or ""),
        }
        body = json.dumps(payload, indent=2)
        self._s3_client.put_object(
            Bucket=self._settings.s3_bucket,
            Key=key,
            Body=body.encode("utf-8"),
            ContentType="application/json",
        )
        return payload

    def get_students(self, email: str) -> dict[str, Any]:
        sanitized = sanitize_email(email)
        return self.get_students_sanitized(sanitized)

    def get_students_sanitized(self, sanitized_email: str) -> dict[str, Any]:
        self._ensure_bucket()
        key = self._students_key(sanitized_email)
        try:
            obj = self._s3_client.get_object(Bucket=self._settings.s3_bucket, Key=key)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") == "NoSuchKey":
                return {"students": []}
            raise
        body = obj["Body"].read().decode("utf-8")
        if not body:
            return {"students": []}
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            return {"students": []}
        if not isinstance(payload, dict):
            return {"students": []}
        raw_students = payload.get("students")
        if not isinstance(raw_students, list):
            return {"students": []}
        students: list[dict[str, str]] = []
        for item in raw_students:
            if not isinstance(item, dict):
                continue
            student_id = str(item.get("id") or "").strip()
            name = str(item.get("name") or "").strip()
            passcode = str(item.get("passcode") or "").strip()
            if not student_id or not name or not passcode:
                continue
            students.append(
                {
                    "id": student_id,
                    "name": name,
                    "passcode": passcode,
                }
            )
        return {"students": students}

    def put_students(self, email: str, students: list[dict[str, Any]]) -> dict[str, Any]:
        sanitized = sanitize_email(email)
        return self.put_students_sanitized(sanitized, students)

    def put_students_sanitized(
        self, sanitized_email: str, students: list[dict[str, Any]]
    ) -> dict[str, Any]:
        self._ensure_bucket()
        key = self._students_key(sanitized_email)
        normalized: list[dict[str, str]] = []
        for item in students:
            if not isinstance(item, dict):
                continue
            student_id = str(item.get("id") or "").strip()
            name = str(item.get("name") or "").strip()
            passcode = str(item.get("passcode") or "").strip()
            if not student_id or not name or not passcode:
                continue
            normalized.append(
                {
                    "id": student_id,
                    "name": name,
                    "passcode": passcode,
                }
            )
        payload = {"students": normalized}
        body = json.dumps(payload, indent=2)
        self._s3_client.put_object(
            Bucket=self._settings.s3_bucket,
            Key=key,
            Body=body.encode("utf-8"),
            ContentType="application/json",
        )
        return payload
