import json
from pathlib import Path

from starlette.requests import Request
from starlette.responses import JSONResponse


def register_health(mcp) -> None:
    @mcp.custom_route("/health", methods=["GET"])
    async def health_check(_: Request) -> JSONResponse:
        return JSONResponse({"status": "ok", "service": "learning-server"})

    @mcp.custom_route("/schema", methods=["GET"])
    async def get_schema(_: Request) -> JSONResponse:
        schema_path = Path(__file__).resolve().parents[4] / "schema.json"
        try:
            payload = json.loads(schema_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            return JSONResponse({"detail": f"Failed to load schema: {exc}"}, status_code=500)
        return JSONResponse(payload)

    @mcp.custom_route("/llm-asset/schema.json", methods=["GET"])
    async def get_llm_schema(_: Request) -> JSONResponse:
        repo_root = Path(__file__).resolve().parents[5]
        schema_path = repo_root / "teacher-portal" / "public" / "llm-assets" / "schema.json"
        try:
            payload = json.loads(schema_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            return JSONResponse(
                {"detail": f"Failed to load LLM schema: {exc}"}, status_code=500
            )
        return JSONResponse(payload)
