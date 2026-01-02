from starlette.responses import JSONResponse

from app.core.settings import Settings


def json_error(detail: str, status_code: int) -> JSONResponse:
    return JSONResponse({"detail": detail}, status_code=status_code)


def public_report_url(settings: Settings, key: str) -> str:
    region = settings.aws_region or "ap-southeast-2"
    bucket = settings.s3_bucket
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
