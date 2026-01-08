import json
from datetime import datetime, timezone

from app.core.settings import Settings
from app.services.lesson_store import LessonStore


def main() -> None:
    settings = Settings()
    store = LessonStore(settings)
    updated = 0
    for account in store.list_account_prefixes():
        lessons = store.list_all_sanitized(account)
        for entry in lessons:
            lesson_id = str(entry.get("id") or "").strip()
            if not lesson_id:
                continue
            lesson = store.get_sanitized(account, lesson_id)
            if not lesson:
                continue
            sections = lesson.get("sections") or {}
            ordered = store._order_sections(sections)
            if list(ordered.items()) == list(sections.items()):
                continue
            lesson["sections"] = ordered
            lesson["updated_at"] = datetime.now(timezone.utc).isoformat()
            lesson_key = store._lesson_key(account, lesson_id)
            store._s3_client.put_object(
                Bucket=store._settings.s3_bucket,
                Key=lesson_key,
                Body=json.dumps(lesson, indent=2).encode("utf-8"),
                ContentType="application/json",
            )
            updated += 1
    print(f"Reordered section index for lessons: {updated}")


if __name__ == "__main__":
    main()
