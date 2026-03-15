import copy
import json
from datetime import datetime, timezone
from hashlib import sha1
from typing import Any

from botocore.exceptions import ClientError

from app.core.settings import Settings
from app.services.lesson_store.s3 import get_s3_client, sanitize_email


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_kind(value: Any) -> str:
    if value == "ai_driven":
        return "ai_driven"
    if value in {"llm", "llm_or_hybrid"}:
        return "ai_driven"
    return "compute"


def _normalize_skill(skill: dict[str, Any]) -> dict[str, Any]:
    normalized = copy.deepcopy(skill)
    normalized["kind"] = _normalize_kind(normalized.get("kind"))
    normalized["usedBy"] = [
        str(item).strip() for item in normalized.get("usedBy", []) if str(item).strip()
    ]
    normalized["id"] = str(normalized.get("id", "")).strip()
    return normalized


def _skill_file_name(skill_id: str) -> str:
    safe_id = "".join(char if char.isalnum() or char in {"_", "-"} else "_" for char in skill_id)
    digest = sha1(skill_id.encode("utf-8")).hexdigest()[:8]
    return f"{safe_id}__{digest}.json"


DEFAULT_SKILLS: list[dict[str, Any]] = [
    {
        "id": "upload_source_document",
        "displayName": "Upload Source Document",
        "description": "Store browser-extracted PDF text and page chunks for a lesson template.",
        "kind": "compute",
        "scope": "system",
        "status": "active",
        "usedBy": ["class_lesson_planner"],
        "prompt": """# upload_source_document

This skill is compute first.

Purpose:
- accept browser-extracted PDF payloads
- persist source document metadata
- persist extracted text and page chunks

Rules:
- do not infer concepts here
- do not clean or rewrite teacher-provided text
- preserve raw extracted text for later review
""",
        "ioSchema": json.dumps(
            {
                "skill": "upload_source_document",
                "type": "compute",
                "input": {
                    "type": "object",
                    "required": ["teacherId", "lessonTemplateId", "documents"],
                },
                "output": {"type": "object", "required": ["storedDocuments"]},
            },
            indent=2,
        ),
    },
    {
        "id": "extract_document_structure",
        "displayName": "Extract Document Structure",
        "description": "Recover title candidates, headings, question blocks, and chunks from PDF text.",
        "kind": "compute",
        "scope": "system",
        "status": "active",
        "usedBy": ["class_lesson_planner"],
        "prompt": """# extract_document_structure

Goal:
- recover usable lesson structure from browser-extracted PDF text

Return:
- title candidates
- likely headings
- question-like blocks
- text chunks grouped by local topic
""",
        "ioSchema": json.dumps(
            {
                "skill": "extract_document_structure",
                "type": "compute",
                "input": {"type": "object", "required": ["documents"]},
                "output": {
                    "type": "object",
                    "required": ["titleCandidates", "headings", "questionBlocks", "chunks"],
                },
            },
            indent=2,
        ),
    },
    {
        "id": "extract_page_questions_ai",
        "displayName": "Extract Page Questions AI",
        "description": "Use AI to copy textbook questions into structured JSON with separate answer options.",
        "kind": "ai_driven",
        "scope": "system",
        "status": "active",
        "usedBy": ["class_lesson_planner"],
        "prompt": """# extract_page_questions_ai

You are copying textbook questions from a PDF exactly as a teacher would if they selected and copied the page content by hand.

Rules:
- preserve the textbook wording as closely as possible
- preserve question numbering and sub-part labels such as 1, (a), (b), 3(d)
- keep answer options separate from the main question text when they are visibly listed
- if a question contains a list of items to choose from or arrange, place those items in answerOptions in reading order
- do not invent missing text
- if a page has no readable questions, return an empty list for that page

Return JSON only in this shape:
{
  "pages": [
    {
      "pageNumber": 1,
      "questions": [
        {
          "label": "1(a)",
          "question": "Define electronegativity.",
          "answerOptions": []
        }
      ]
    }
  ]
}
""",
        "ioSchema": json.dumps(
            {
                "skill": "extract_page_questions_ai",
                "type": "ai_driven",
                "input": {"type": "object", "required": ["pdfFile", "pageCount"]},
                "output": {
                    "type": "object",
                    "required": ["pages"],
                    "properties": {
                        "pages": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "required": ["pageNumber", "questions"],
                                "properties": {
                                    "pageNumber": {"type": "integer"},
                                    "questions": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "required": ["question", "answerOptions"],
                                            "properties": {
                                                "label": {"type": "string"},
                                                "question": {"type": "string"},
                                                "answerOptions": {
                                                    "type": "array",
                                                    "items": {"type": "string"},
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        }
                    },
                },
            },
            indent=2,
        ),
    },
    {
        "id": "extract_concepts",
        "displayName": "Extract Concepts",
        "description": "Propose a compact teacher-reviewable concept list from document structure.",
        "kind": "ai_driven",
        "scope": "system",
        "status": "active",
        "usedBy": ["class_lesson_planner"],
        "prompt": """# extract_concepts

You are helping a teacher build a generic class lesson template from source material.

Task:
- propose the best lesson title
- derive the core teaching concepts
- keep the concept list short, teachable, and reviewable by a human
""",
        "ioSchema": json.dumps(
            {
                "skill": "extract_concepts",
                "type": "ai_driven",
                "input": {"type": "object", "required": ["titleCandidates", "headings", "chunks"]},
                "output": {"type": "object", "required": ["suggestedTitle", "concepts"]},
            },
            indent=2,
        ),
    },
    {
        "id": "build_section_drafts",
        "displayName": "Build Section Drafts",
        "description": "Draft one editable teacher-facing section per approved concept.",
        "kind": "ai_driven",
        "scope": "system",
        "status": "active",
        "usedBy": ["class_lesson_planner"],
        "prompt": """# build_section_drafts

You are drafting editable lesson sections for a teacher.

For each approved concept:
- write a short synopsis
- write practical teaching notes
- draft review or discussion questions
""",
        "ioSchema": json.dumps(
            {
                "skill": "build_section_drafts",
                "type": "ai_driven",
                "input": {
                    "type": "object",
                    "required": ["lessonTitle", "concepts", "sourceChunks"],
                },
                "output": {"type": "object", "required": ["sections"]},
            },
            indent=2,
        ),
    },
    {
        "id": "publish_lesson",
        "displayName": "Publish Lesson",
        "description": "Validate the lesson template before public release.",
        "kind": "compute",
        "scope": "system",
        "status": "active",
        "usedBy": ["class_lesson_planner"],
        "prompt": """# publish_lesson

This skill is compute first.

Goal:
- validate that a generic lesson template is ready for public use
""",
        "ioSchema": json.dumps(
            {
                "skill": "publish_lesson",
                "type": "compute",
                "input": {"type": "object", "required": ["lessonTemplate", "sections"]},
                "output": {"type": "object", "required": ["status", "checks"]},
            },
            indent=2,
        ),
    },
]


class SkillStore:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._s3_client = get_s3_client(settings)

    def _ensure_bucket(self) -> None:
        if not self._settings.s3_bucket:
            raise RuntimeError("S3 bucket not configured")

    def _skills_key(self, sanitized_email: str) -> str:
        return f"{self._settings.s3_prefix}/{sanitized_email}/skills/index.json"

    def _skills_prefix(self, sanitized_email: str) -> str:
        return f"{self._settings.s3_prefix}/{sanitized_email}/skills"

    def _skill_key(self, sanitized_email: str, skill_id: str) -> str:
        return f"{self._skills_prefix(sanitized_email)}/{_skill_file_name(skill_id)}"

    def _build_default_skills(self) -> list[dict[str, Any]]:
        now = _timestamp()
        seeded = copy.deepcopy(DEFAULT_SKILLS)
        for item in seeded:
            normalized = _normalize_skill(item)
            item.clear()
            item.update(normalized)
            item["updatedAt"] = now
        return seeded

    def _merge_missing_default_skills(self, skills: list[dict[str, Any]]) -> list[dict[str, Any]]:
        existing_ids = {str(skill.get("id")) for skill in skills}
        merged = list(skills)
        for default_skill in self._build_default_skills():
            if str(default_skill.get("id")) in existing_ids:
                continue
            merged.append(default_skill)
        return merged

    def _load_json_object(self, key: str) -> dict[str, Any] | None:
        try:
            obj = self._s3_client.get_object(Bucket=self._settings.s3_bucket, Key=key)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") == "NoSuchKey":
                return None
            raise
        body = obj["Body"].read().decode("utf-8")
        if not body:
            return None
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            return None
        return payload if isinstance(payload, dict) else None

    def _save_json_object(self, key: str, payload: dict[str, Any]) -> None:
        self._s3_client.put_object(
            Bucket=self._settings.s3_bucket,
            Key=key,
            Body=json.dumps(payload, indent=2).encode("utf-8"),
            ContentType="application/json",
        )

    def _delete_object(self, key: str) -> None:
        self._s3_client.delete_object(Bucket=self._settings.s3_bucket, Key=key)

    def _build_index_payload(self, sanitized_email: str, skills: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "version": 2,
            "skills": [
                {
                    "id": skill["id"],
                    "displayName": skill["displayName"],
                    "kind": skill["kind"],
                    "scope": skill["scope"],
                    "status": skill["status"],
                    "usedBy": skill["usedBy"],
                    "updatedAt": skill["updatedAt"],
                    "key": self._skill_key(sanitized_email, skill["id"]),
                }
                for skill in skills
            ],
        }

    def _load_skills_from_index_entries(
        self, sanitized_email: str, entries: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        skills: list[dict[str, Any]] = []
        changed = False
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            skill_id = str(entry.get("id", "")).strip()
            if not skill_id:
                continue
            key = str(entry.get("key") or self._skill_key(sanitized_email, skill_id))
            payload = self._load_json_object(key)
            if payload is None:
                changed = True
                continue
            normalized = _normalize_skill(payload)
            if normalized != payload:
                self._save_json_object(key, normalized)
                changed = True
            skills.append(normalized)
        if changed:
            self._save_json_object(self._skills_key(sanitized_email), self._build_index_payload(sanitized_email, skills))
        return skills

    def _load_skills_sanitized(self, sanitized_email: str) -> list[dict[str, Any]]:
        self._ensure_bucket()
        key = self._skills_key(sanitized_email)
        payload = self._load_json_object(key)
        if payload is None:
            seeded = self._build_default_skills()
            self._save_skills_sanitized(sanitized_email, seeded)
            return seeded
        if not isinstance(payload, dict) or not isinstance(payload.get("skills"), list):
            seeded = self._build_default_skills()
            self._save_skills_sanitized(sanitized_email, seeded)
            return seeded
        if payload.get("version") == 2:
            skills = self._load_skills_from_index_entries(sanitized_email, payload["skills"])
            if skills:
                merged = self._merge_missing_default_skills(skills)
                if len(merged) != len(skills):
                    self._save_skills_sanitized(sanitized_email, merged)
                    return merged
                return skills
            seeded = self._build_default_skills()
            self._save_skills_sanitized(sanitized_email, seeded)
            return seeded
        skills = [_normalize_skill(item) for item in payload["skills"] if isinstance(item, dict)]
        merged = self._merge_missing_default_skills(skills)
        self._save_skills_sanitized(sanitized_email, merged)
        return merged

    def _save_skills_sanitized(self, sanitized_email: str, skills: list[dict[str, Any]]) -> None:
        self._ensure_bucket()
        normalized_skills = [_normalize_skill(skill) for skill in skills]
        prefix = self._skills_prefix(sanitized_email)
        response = self._s3_client.list_objects_v2(Bucket=self._settings.s3_bucket, Prefix=f"{prefix}/")
        existing_keys = {
            item["Key"]
            for item in response.get("Contents", [])
            if item.get("Key") and item["Key"] != self._skills_key(sanitized_email)
        }
        next_keys: set[str] = set()
        for skill in normalized_skills:
            skill_key = self._skill_key(sanitized_email, skill["id"])
            next_keys.add(skill_key)
            self._save_json_object(skill_key, skill)
        for stale_key in existing_keys - next_keys:
            self._delete_object(stale_key)
        self._save_json_object(
            self._skills_key(sanitized_email),
            self._build_index_payload(sanitized_email, normalized_skills),
        )

    def list_skills(self, email: str) -> list[dict[str, Any]]:
        sanitized = sanitize_email(email)
        return self._load_skills_sanitized(sanitized)

    def get_skill(self, email: str, skill_id: str) -> dict[str, Any] | None:
        sanitized = sanitize_email(email)
        skills = self._load_skills_sanitized(sanitized)
        for item in skills:
            if str(item.get("id")) == skill_id:
                return item
        return None

    def create_skill(self, email: str) -> dict[str, Any]:
        sanitized = sanitize_email(email)
        skills = self._load_skills_sanitized(sanitized)
        skill_id = f"teacher_skill_{int(datetime.now(timezone.utc).timestamp() * 1000)}"
        created = {
            "id": skill_id,
            "displayName": "New Skill",
            "description": "Describe what this skill does.",
            "kind": "compute",
            "scope": "teacher",
            "status": "draft",
            "usedBy": ["class_lesson_planner"],
            "prompt": "# new_skill\n\nDescribe the behavior here.\n",
            "ioSchema": json.dumps({"skill": skill_id, "type": "compute"}, indent=2),
            "updatedAt": _timestamp(),
        }
        skills.insert(0, created)
        self._save_skills_sanitized(sanitized, skills)
        return created

    def update_skill(self, email: str, skill_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        sanitized = sanitize_email(email)
        skills = self._load_skills_sanitized(sanitized)
        for item in skills:
            if str(item.get("id")) != skill_id:
                continue
            allowed = {
                "displayName",
                "description",
                "kind",
                "scope",
                "status",
                "usedBy",
                "prompt",
                "ioSchema",
            }
            for key, value in updates.items():
                if key in allowed:
                    item[key] = _normalize_kind(value) if key == "kind" else value
            item["updatedAt"] = _timestamp()
            self._save_skills_sanitized(sanitized, skills)
            return item
        return None

    def delete_skill(self, email: str, skill_id: str) -> bool:
        sanitized = sanitize_email(email)
        skills = self._load_skills_sanitized(sanitized)
        remaining = [item for item in skills if str(item.get("id")) != skill_id]
        if len(remaining) == len(skills):
            return False
        self._save_skills_sanitized(sanitized, remaining)
        return True

    def duplicate_skill(self, email: str, skill_id: str) -> dict[str, Any] | None:
        sanitized = sanitize_email(email)
        skills = self._load_skills_sanitized(sanitized)
        for item in skills:
            if str(item.get("id")) != skill_id:
                continue
            duplicated = copy.deepcopy(item)
            duplicated["id"] = f"{skill_id}_copy_{int(datetime.now(timezone.utc).timestamp() * 1000)}"
            duplicated["displayName"] = f"{item.get('displayName', 'Skill')} Copy"
            duplicated["scope"] = "teacher"
            duplicated["status"] = "draft"
            duplicated["updatedAt"] = _timestamp()
            skills.insert(0, duplicated)
            self._save_skills_sanitized(sanitized, skills)
            return duplicated
        return None

    def reset_skills(self, email: str) -> list[dict[str, Any]]:
        sanitized = sanitize_email(email)
        seeded = self._build_default_skills()
        self._save_skills_sanitized(sanitized, seeded)
        return seeded
