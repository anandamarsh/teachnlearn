from dataclasses import dataclass


@dataclass
class Lesson:
    id: str
    title: str
    status: str
    subject: str | None
    level: str | None
    requires_login: bool | None
    summary: str | None
    exercise_config: dict[str, int] | None
    created_at: str
    updated_at: str
