import argparse
import json
from typing import Any

from botocore.exceptions import ClientError

from app.core.settings import get_settings
from app.services.lesson_store import LessonStore


def migrate_exercise_steps(store: LessonStore, dry_run: bool) -> None:
    settings = get_settings()
    bucket = settings.s3_bucket
    prefix = settings.s3_prefix
    if not bucket or not prefix:
        raise RuntimeError("S3 bucket/prefix not configured")
    accounts = store.list_account_prefixes()
    for sanitized_email in accounts:
        lessons = store.list_all_sanitized(sanitized_email)
        for lesson in lessons:
            lesson_id = str(lesson.get("id") or "").strip()
            if not lesson_id:
                continue
            lesson_payload = store.get_sanitized(sanitized_email, lesson_id)
            if not lesson_payload:
                continue
            sections = lesson_payload.get("sections") or {}
            for section_key, filename in sections.items():
                if store._section_base_key(section_key) != "exercises":
                    continue
                key = store._section_key(sanitized_email, lesson_id, filename)
                try:
                    obj = store._s3_client.get_object(Bucket=bucket, Key=key)
                except ClientError as exc:
                    if exc.response.get("Error", {}).get("Code") in ("NoSuchKey", "404"):
                        continue
                    raise
                raw = obj["Body"].read().decode("utf-8")
                try:
                    payload = json.loads(raw) if raw else []
                except json.JSONDecodeError:
                    continue
                if not isinstance(payload, list):
                    continue
                changed = False
                for exercise in payload:
                    if not isinstance(exercise, dict):
                        continue
                    steps = exercise.get("steps")
                    if not isinstance(steps, list):
                        continue
                    for step in steps:
                        if not isinstance(step, dict):
                            continue
                        if "step_html" not in step and "step" in step:
                            step["step_html"] = step.get("step") or ""
                            step.pop("step", None)
                            changed = True
                if not changed:
                    continue
                if dry_run:
                    print(f"[DRY RUN] Would update {key}")
                    continue
                store._s3_client.put_object(
                    Bucket=bucket,
                    Key=key,
                    Body=json.dumps(payload, indent=2).encode("utf-8"),
                    ContentType="application/json",
                )
                print(f"Updated {key}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Rename exercise step field from step -> step_html in S3."
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    settings = get_settings()
    store = LessonStore(settings)
    migrate_exercise_steps(store, args.dry_run)


if __name__ == "__main__":
    main()
