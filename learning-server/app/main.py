import logging
import re
from urllib.parse import parse_qsl, urlencode

from dotenv import load_dotenv
from fastmcp import FastMCP
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocket, WebSocketDisconnect

from app.api.routes import lesson_http, lesson_mcp
from app.core.auth import get_email_from_token
from app.core.settings import get_settings, parse_cors_origins
from app.services.lesson_events import LessonEventHub
from app.services.lesson_store import LessonStore

load_dotenv()
print("[DEBUG] learning-server starting up")

settings = get_settings()
store = LessonStore(settings)
events = LessonEventHub()
logger = logging.getLogger("learning-server")
logging.getLogger("uvicorn.access").disabled = False
uvicorn_access = logging.getLogger("uvicorn.access")
logging.getLogger("websockets").setLevel(logging.WARNING)


class DropWebSocketAccess(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        return "WebSocket" not in message and "connection " not in message


uvicorn_access.addFilter(DropWebSocketAccess())

_TOKEN_PATTERN = re.compile(r"(token=)([^&\\s]+)")


def _redact_query(query: str) -> str:
    def replace(match: re.Match[str]) -> str:
        token = match.group(2)
        truncated = f"{token[:16]}..." if len(token) > 16 else token
        return f"{match.group(1)}{truncated}"

    return _TOKEN_PATTERN.sub(replace, query)


class RedactedAccessLogger:
    def __init__(self, app):
        self._app = app

    async def __call__(self, scope, receive, send):  # type: ignore[override]
        scope_type = scope.get("type")
        if scope_type == "http":
            method = scope.get("method", "GET")
            path = scope.get("path", "")
            query = scope.get("query_string", b"").decode("utf-8")
            target = f"{path}?{_redact_query(query)}" if query else path
            status_code = "-"

            async def send_wrapper(message):
                nonlocal status_code
                if message.get("type") == "http.response.start":
                    status_code = message.get("status", "-")
                await send(message)

            await self._app(scope, receive, send_wrapper)
            logger.info("%s %s %s", method, target, status_code)
            return
        if scope_type == "websocket":
            await self._app(scope, receive, send)
            return
        await self._app(scope, receive, send)

mcp = FastMCP("learning-server")

cors_origins = settings.cors_origins or parse_cors_origins()
middleware: list[Middleware] | None = None
if cors_origins:
    middleware = [
        Middleware(
            CORSMiddleware,
            allow_origins=cors_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allow_headers=[
                "Content-Type",
                "Authorization",
                "mcp-protocol-version",
                "mcp-session-id",
            ],
            expose_headers=["mcp-session-id"],
        )
    ]

lesson_http.register_routes(mcp, store, settings, events)
lesson_mcp.register_routes(mcp, store, settings, events)

app = mcp.http_app(middleware=middleware)


async def lesson_updates_socket(websocket: WebSocket) -> None:
    token = websocket.query_params.get("token", "").strip()
    if token:
        masked = f"{token[:4]}..."
        scope = websocket.scope
        query = scope.get("query_string", b"").decode("utf-8")
        if query:
            params = dict(parse_qsl(query, keep_blank_values=True))
            if "token" in params:
                params["token"] = masked
                scope["query_string"] = urlencode(params, doseq=True).encode("utf-8")
    email = None
    if settings.auth0_domain and settings.auth0_audience:
        email = get_email_from_token(token, settings)
    else:
        email = websocket.query_params.get("email", "").strip() or None
    if not email:
        await websocket.close(code=4401)
        return
    await websocket.accept()
    await events.connect(email, websocket)
    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass
    finally:
        await events.disconnect(email, websocket)


app.add_websocket_route("/ws/lessons", lesson_updates_socket)
