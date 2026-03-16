from urllib.parse import quote

from starlette.responses import JSONResponse

from app.core.settings import Settings


def json_error(detail: str, status_code: int) -> JSONResponse:
    return JSONResponse({"detail": detail}, status_code=status_code)


def public_object_url(settings: Settings, key: str) -> str:
    region = settings.aws_region or "ap-southeast-2"
    bucket = settings.s3_bucket
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


def public_report_url(settings: Settings, key: str) -> str:
    return public_object_url(settings, key)


def content_disposition(filename: str, inline: bool = False) -> str:
    safe_name = str(filename or "file").replace('"', "")
    mode = "inline" if inline else "attachment"
    return f"{mode}; filename*=UTF-8''{quote(safe_name)}"


def presigned_object_url(
    settings: Settings,
    s3_client,
    key: str,
    *,
    filename: str = "file",
    content_type: str | None = None,
    inline: bool = False,
    expires_in: int = 3600,
) -> str:
    params = {
      "Bucket": settings.s3_bucket,
      "Key": key,
      "ResponseContentDisposition": content_disposition(filename, inline=inline),
    }
    if content_type:
        params["ResponseContentType"] = content_type
    return s3_client.generate_presigned_url(
        "get_object",
        Params=params,
        ExpiresIn=expires_in,
    )
