import json
from typing import Any

from botocore.exceptions import ClientError

from .s3 import sanitize_email


class LessonStoreProfile:
    def _profile_key(self, sanitized_email: str) -> str:
        return f"{self._settings.s3_prefix}/{sanitized_email}/teacher.json"

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
