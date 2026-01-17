from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.auth import get_request_email
from app.core.otp import generate_otp
from app.core.settings import Settings


def register_auth_routes(mcp, settings: Settings) -> None:
    @mcp.custom_route("/auth/otp", methods=["POST"])
    async def generate_login_otp(request: Request) -> JSONResponse:
        email = get_request_email(request, None, settings)
        code = generate_otp(email, settings)
        return JSONResponse(
            {
                "code": code,
                "email": email,
                "expiresIn": settings.otp_ttl_seconds,
            }
        )
