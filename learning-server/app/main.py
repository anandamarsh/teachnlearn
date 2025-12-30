from dotenv import load_dotenv
from fastmcp import FastMCP
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware

from app.api.routes import lesson_http, lesson_mcp
from app.core.settings import get_settings, parse_cors_origins
from app.services.lesson_store import LessonStore

load_dotenv()

settings = get_settings()
store = LessonStore(settings)

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

lesson_http.register_routes(mcp, store, settings)
lesson_mcp.register_routes(mcp, store)

app = mcp.http_app(middleware=middleware)
