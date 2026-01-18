import json

from botocore.exceptions import ClientError

from app.core.settings import get_settings
from app.services.lesson_store import LessonStore


def migrate_summary_field() -> None:
    settings = get_settings()
    store = LessonStore(settings)
    updated = 0
    skipped = 0

    for account in store.list_account_prefixes():
        lessons = store.list_all_sanitized(account)
        for entry in lessons:
            lesson_id = str(entry.get("id") or "").strip()
            if not lesson_id:
                continue
            lesson = store.get_sanitized(account, lesson_id)
            if not lesson:
                continue
            summary_value = lesson.get("summary")
            if summary_value is None:
                summary_value = lesson.get("content")
            if summary_value is None:
                summary_value = ""

            changed = False
            if lesson.get("summary") != summary_value:
                lesson["summary"] = summary_value
                changed = True
            if "content" in lesson:
                lesson.pop("content", None)
                changed = True

            if not changed:
                skipped += 1
                continue

            key = store._lesson_key(account, lesson_id)
            try:
                store._s3_client.put_object(
                    Bucket=settings.s3_bucket,
                    Key=key,
                    Body=json.dumps(lesson, indent=2).encode("utf-8"),
                    ContentType="application/json",
                )
                updated += 1
            except ClientError as exc:
                raise RuntimeError(f"Failed to update {account}/{lesson_id}: {exc}") from exc

    print(f"Updated lessons: {updated}")
    print(f"Already ok: {skipped}")


if __name__ == "__main__":
    migrate_summary_field()
