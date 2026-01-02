from botocore.exceptions import ClientError

from .s3 import sanitize_email


class LessonStoreReports:
    def report_exists(self, email: str, lesson_id: str) -> bool:
        sanitized = sanitize_email(email)
        key = self._report_key(sanitized, lesson_id)
        try:
            self._s3_client.head_object(Bucket=self._settings.s3_bucket, Key=key)
            return True
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in {"404", "NoSuchKey"}:
                return False
            raise

    def put_report(self, email: str, lesson_id: str, html: str) -> str:
        sanitized = sanitize_email(email)
        self._ensure_bucket()
        key = self._report_key(sanitized, lesson_id)
        self._s3_client.put_object(
            Bucket=self._settings.s3_bucket,
            Key=key,
            Body=html.encode("utf-8"),
            ContentType="text/html",
        )
        return key
