import json
from typing import Any

from app.core.settings import Settings
from app.services.lesson_store import LessonStore


def load_section_content(store: LessonStore, key: str) -> str:
    try:
        obj = store._s3_client.get_object(
            Bucket=store._settings.s3_bucket,
            Key=key,
        )
    except Exception:
        return ""
    return obj["Body"].read().decode("utf-8")


def ensure_lesson_meta(store: LessonStore, sanitized_email: str, lesson_id: str) -> bool:
    lesson = store.get_sanitized(sanitized_email, lesson_id)
    if not lesson:
        return False
    sections = lesson.get("sections") or {}
    sections_meta = lesson.get("sectionsMeta") or {}
    updated = False
    for section_key, filename in sections.items():
        if section_key in sections_meta:
            continue
        section_storage_key = store._section_key(sanitized_email, lesson_id, filename)
        content = load_section_content(store, section_storage_key)
        sections_meta[section_key] = {
            "key": section_key,
            "updatedAt": lesson.get("updated_at"),
            "version": 1,
            "contentLength": len(content.strip()),
        }
        updated = True
    if not updated:
        return False
    lesson["sectionsMeta"] = sections_meta
    lesson_key = store._lesson_key(sanitized_email, lesson_id)
    store._s3_client.put_object(
        Bucket=store._settings.s3_bucket,
        Key=lesson_key,
        Body=json.dumps(lesson, indent=2).encode("utf-8"),
        ContentType="application/json",
    )
    return True


def main() -> None:
    settings = Settings()
    store = LessonStore(settings)
    updated_count = 0
    for account in store.list_account_prefixes():
        lessons = store.list_all_sanitized(account)
        for entry in lessons:
            lesson_id = str(entry.get("id") or "").strip()
            if not lesson_id:
                continue
            if ensure_lesson_meta(store, account, lesson_id):
                updated_count += 1
    print(f"Updated lessons: {updated_count}")


if __name__ == "__main__":
    main()
