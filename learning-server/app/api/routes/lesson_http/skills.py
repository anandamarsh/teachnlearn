from typing import Any

from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.auth import get_request_email
from app.core.settings import Settings
from app.services.skill_store import SkillStore

from .common import json_error


def register_skill_routes(mcp: Any, settings: Settings, skill_store: SkillStore) -> None:
    @mcp.custom_route("/skills", methods=["GET"])
    async def list_skills(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        try:
            return JSONResponse({"skills": skill_store.list_skills(email)})
        except RuntimeError as exc:
            return json_error(str(exc), 500)

    @mcp.custom_route("/skills", methods=["POST"])
    async def create_skill(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        try:
            created = skill_store.create_skill(email)
        except RuntimeError as exc:
            return json_error(str(exc), 500)
        return JSONResponse(created, status_code=201)

    @mcp.custom_route("/skills/reset", methods=["POST"])
    async def reset_skills(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        try:
            skills = skill_store.reset_skills(email)
        except RuntimeError as exc:
            return json_error(str(exc), 500)
        return JSONResponse({"skills": skills})

    @mcp.custom_route("/skills/id/{skill_id}", methods=["PUT"])
    async def update_skill(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        skill_id = request.path_params.get("skill_id", "").strip()
        if not skill_id:
            return json_error("skill_id is required", 400)
        try:
            payload = await request.json()
        except Exception:
            return json_error("invalid JSON body", 400)
        if not isinstance(payload, dict):
            return json_error("invalid JSON body", 400)
        try:
            updated = skill_store.update_skill(email, skill_id, payload)
        except RuntimeError as exc:
            return json_error(str(exc), 500)
        if updated is None:
            return json_error("skill not found", 404)
        return JSONResponse(updated)

    @mcp.custom_route("/skills/id/{skill_id}", methods=["DELETE"])
    async def delete_skill(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        skill_id = request.path_params.get("skill_id", "").strip()
        if not skill_id:
            return json_error("skill_id is required", 400)
        try:
            deleted = skill_store.delete_skill(email, skill_id)
        except RuntimeError as exc:
            return json_error(str(exc), 500)
        if not deleted:
            return json_error("skill not found", 404)
        return JSONResponse({"deleted": True})

    @mcp.custom_route("/skills/id/{skill_id}/duplicate", methods=["POST"])
    async def duplicate_skill(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        if not email:
            return json_error("email is required", 400)
        skill_id = request.path_params.get("skill_id", "").strip()
        if not skill_id:
            return json_error("skill_id is required", 400)
        try:
            duplicated = skill_store.duplicate_skill(email, skill_id)
        except RuntimeError as exc:
            return json_error(str(exc), 500)
        if duplicated is None:
            return json_error("skill not found", 404)
        return JSONResponse(duplicated, status_code=201)
