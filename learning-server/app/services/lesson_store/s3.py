import boto3
from botocore.exceptions import ClientError

from app.core.settings import Settings


def get_s3_client(settings: Settings) -> boto3.client:
    return boto3.client("s3", region_name=settings.aws_region)


def sanitize_email(email: str) -> str:
    email = email.strip().lower()
    sanitized: list[str] = []
    for ch in email:
        if ch.isalnum():
            sanitized.append(ch)
        elif ch == "@":
            sanitized.append("_at_")
        elif ch == ".":
            sanitized.append("_dot_")
        else:
            sanitized.append("_")
    return "".join(sanitized).strip("_")


def ensure_lesson_prefix(sanitized_email: str, lesson_id: str, settings: Settings) -> None:
    if not settings.s3_bucket:
        raise RuntimeError("S3 bucket not configured")
    s3_client = get_s3_client(settings)
    key = f"{settings.s3_prefix}/{sanitized_email}/lessons/{lesson_id}/"
    s3_client.put_object(Bucket=settings.s3_bucket, Key=key, Body=b"")


def delete_lesson_prefix(sanitized_email: str, lesson_id: str, settings: Settings) -> None:
    if not settings.s3_bucket:
        raise RuntimeError("S3 bucket not configured")
    s3_client = get_s3_client(settings)
    prefix = f"{settings.s3_prefix}/{sanitized_email}/lessons/{lesson_id}/"
    lesson_key = f"{prefix}index.json"
    # Best-effort deletes for common objects in the lesson folder.
    for key in (lesson_key, prefix):
        try:
            s3_client.delete_object(Bucket=settings.s3_bucket, Key=key)
        except ClientError:
            pass

    # Remove all versions/delete markers when bucket versioning is enabled.
    versions_paginator = s3_client.get_paginator("list_object_versions")
    version_items: list[dict[str, str]] = []
    for page in versions_paginator.paginate(Bucket=settings.s3_bucket, Prefix=prefix):
        for obj in page.get("Versions", []):
            version_items.append({"Key": obj["Key"], "VersionId": obj["VersionId"]})
        for marker in page.get("DeleteMarkers", []):
            version_items.append({"Key": marker["Key"], "VersionId": marker["VersionId"]})
    if version_items:
        s3_client.delete_objects(Bucket=settings.s3_bucket, Delete={"Objects": version_items})
        return

    paginator = s3_client.get_paginator("list_objects_v2")
    keys: list[dict[str, str]] = []
    for page in paginator.paginate(Bucket=settings.s3_bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            keys.append({"Key": obj["Key"]})
    if keys:
        s3_client.delete_objects(Bucket=settings.s3_bucket, Delete={"Objects": keys})
