import os
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


@lru_cache
def get_settings() -> Settings:
    return Settings()


def parse_cors_origins() -> list[str]:
    return [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "").split(",")
        if origin.strip()
    ]
