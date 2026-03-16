import json

from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.auth import get_request_email
from app.core.otp import generate_otp
from app.core.student_auth import (
    STUDENT_SESSION_COOKIE,
    create_student_session_token,
    get_student_session,
)
from app.core.settings import Settings
from app.services.lesson_store import LessonStore

from .common import json_error


def register_auth_routes(mcp, store: LessonStore, settings: Settings) -> None:
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

    def find_matching_student(student_name: str, passcode: str):
        for teacher in store.list_account_prefixes():
            roster = store.get_students_sanitized(teacher)
            students = roster.get("students") if isinstance(roster, dict) else []
            if not isinstance(students, list):
                continue
            matched_student = next(
                (
                    student
                    for student in students
                    if str(student.get("name") or "").strip().lower()
                    == student_name.lower()
                    and str(student.get("passcode") or "").strip() == passcode
                ),
                None,
            )
            if matched_student:
                return teacher, matched_student
        return None, None

    @mcp.custom_route("/student/login", methods=["POST"])
    async def student_login(request: Request) -> JSONResponse:
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            return json_error("invalid JSON body", 400)
        if not isinstance(payload, dict):
            return json_error("invalid JSON body", 400)

        student_name = str(payload.get("name") or "").strip()
        passcode = str(payload.get("passcode") or "").strip()
        if not student_name or not passcode:
            return json_error("name and passcode are required", 400)

        try:
            teacher, matched_student = find_matching_student(student_name, passcode)
        except RuntimeError:
            teacher, matched_student = None, None
        if not teacher or not matched_student:
            return json_error("name or passcode is incorrect", 403)

        token = create_student_session_token(
            teacher,
            str(matched_student.get("id") or "").strip(),
            str(matched_student.get("name") or "").strip(),
            settings,
        )
        response = JSONResponse(
            {
                "authenticated": True,
                "student": {
                    "id": str(matched_student.get("id") or "").strip(),
                    "name": str(matched_student.get("name") or "").strip(),
                },
            }
        )
        response.set_cookie(
            STUDENT_SESSION_COOKIE,
            token,
            httponly=True,
            samesite="lax",
            secure=request.url.scheme == "https",
            max_age=settings.student_session_ttl_seconds,
            path="/",
        )
        return response

    @mcp.custom_route("/student/session", methods=["GET"])
    async def get_student_auth_session(request: Request) -> JSONResponse:
        session = get_student_session(request, settings)
        if not session:
            return json_error("not authenticated", 401)
        return JSONResponse(
            {
                "authenticated": True,
                "student": {
                    "id": session["studentId"],
                    "name": session["studentName"],
                },
            }
        )

    @mcp.custom_route("/student/logout", methods=["POST"])
    async def student_logout(request: Request) -> JSONResponse:
        response = JSONResponse({"authenticated": False})
        response.delete_cookie(STUDENT_SESSION_COOKIE, path="/", samesite="lax")
        return response
