import json
import os
from pathlib import Path
from functools import lru_cache


class Settings:
    def __init__(self) -> None:
        self.auth0_domain = os.getenv("AUTH0_DOMAIN", "")
        self.auth0_audience = os.getenv("AUTH0_AUDIENCE", "")
        self.aws_region = os.getenv("AWS_REGION", "ap-southeast-2")
        self.s3_bucket = os.getenv("S3_BUCKET", "")
        self.s3_prefix = os.getenv("S3_PREFIX", "client_data")
        self.cors_origins = [
            origin.strip()
            for origin in os.getenv("CORS_ORIGINS", "").split(",")
            if origin.strip()
        ]
        self.lesson_sections_path = os.getenv("LESSON_SECTIONS_FILE") or str(
            Path(__file__).resolve().parents[2] / "lesson_sections.json"
        )
        self.custom_gpt_api_key = os.getenv("CUSTOM_GPT_API_KEY", "")
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "")
        self.openai_project_id = os.getenv("OPENAI_PROJECT_ID", "")
        self.openai_question_extraction_model = os.getenv(
            "OPENAI_QUESTION_EXTRACTION_MODEL", "gpt-5.4"
        )
        self.openai_question_extraction_input_price_per_million = float(
            os.getenv("OPENAI_QUESTION_EXTRACTION_INPUT_PRICE_PER_MILLION", "0.40")
        )
        self.openai_question_extraction_cached_input_price_per_million = float(
            os.getenv(
                "OPENAI_QUESTION_EXTRACTION_CACHED_INPUT_PRICE_PER_MILLION", "0.10"
            )
        )
        self.openai_question_extraction_output_price_per_million = float(
            os.getenv("OPENAI_QUESTION_EXTRACTION_OUTPUT_PRICE_PER_MILLION", "1.60")
        )
        self.openai_timeout_seconds = int(os.getenv("OPENAI_TIMEOUT_SECONDS", "90"))
        self.otp_ttl_seconds = int(os.getenv("OTP_TTL_SECONDS", "600"))
        self.lesson_sections, self.lesson_section_descriptions = _load_lesson_sections(
            self.lesson_sections_path
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


def parse_cors_origins() -> list[str]:
    return [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "").split(",")
        if origin.strip()
    ]


def _load_lesson_sections(path: str) -> tuple[list[str], dict[str, str]]:
    default = [
        "assessment",
        "concepts",
        "background",
        "lesson",
        "exercises",
    ]
    descriptions: dict[str, str] = {}
    if not path:
        return default, descriptions
    try:
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default, descriptions
    if isinstance(payload, list):
        sections = payload
    else:
        if isinstance(payload, dict):
            sections = payload.get("sections", [])
            payload_descriptions = payload.get("descriptions")
            if isinstance(payload_descriptions, dict):
                descriptions = {
                    str(key).strip().lower(): str(value).strip()
                    for key, value in payload_descriptions.items()
                    if str(key).strip() and str(value).strip()
                }
        else:
            sections = []
    cleaned = [str(item).strip().lower() for item in sections if str(item).strip()]
    return cleaned or default, descriptions
