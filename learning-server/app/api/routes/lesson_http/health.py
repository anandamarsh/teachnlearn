from starlette.requests import Request
from starlette.responses import JSONResponse


def register_health(mcp) -> None:
    @mcp.custom_route("/health", methods=["GET"])
    async def health_check(_: Request) -> JSONResponse:
        return JSONResponse({"status": "ok", "service": "learning-server"})
