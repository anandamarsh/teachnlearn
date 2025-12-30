from dataclasses import dataclass


@dataclass
class Lesson:
    id: str
    title: str
    status: str
    content: str | None
    created_at: str
    updated_at: str
