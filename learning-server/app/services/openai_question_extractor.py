import hashlib
import json
import logging
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
import re
from typing import Any

import requests
from pypdf import PdfReader

from app.core.settings import Settings
from app.services.textbook_ocr import extract_pdf_text_by_columns

logger = logging.getLogger("learning-server.openai")

_OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"

_SYSTEM_PROMPT = (
    "You extract only student-facing questions from PDF pages. "
    "Do not guess or invent text. "
    "If a page does not clearly contain readable questions, return an empty array for that page."
)

_DEFAULT_SKILL_PROMPT = """# extract_page_questions_ai

You are copying textbook questions from a PDF exactly as a teacher would if they selected and copied the page content by hand.

Rules:
- preserve the textbook wording as closely as possible
- preserve question numbering and sub-part labels such as 1, (a), (b), 3(d)
- keep answer options separate from the main question text when they are visibly listed
- if a question contains a list of items to choose from or arrange, place those items in answerOptions in reading order
- do not invent missing text
- if a page has no readable questions, return an empty list for that page
"""


def _trace(message: str) -> None:
    print(f"[DEBUG] [OPENAI] {message}", flush=True)
    logger.info("[OPENAI] %s", message)


def _openai_headers(settings: Settings, *, json_content: bool) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {settings.openai_api_key}"}
    if json_content:
        headers["Content-Type"] = "application/json"
    if settings.openai_project_id:
        headers["OpenAI-Project"] = settings.openai_project_id
    return headers


def _clean_line(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _is_question_header(line: str) -> bool:
    return bool(re.match(r"^(questions|check your knowledge|review questions|exercise)\b", line, re.I))


def _looks_like_question_start(line: str) -> bool:
    return bool(
        re.match(r"^\d+\.\s+", line)
        or re.match(r"^\([a-z]\)\s+", line, re.I)
        or re.match(r"^[ivxlcdm]+\.\s+", line, re.I)
        or re.match(
            r"^(define|name|identify|list|calculate|check|which|what|why|how|state|explain|describe|predict|compare|give|write|determine|order|use)\b",
            line,
            re.I,
        )
    )


def _extract_question_section_text(page_text: str) -> str:
    raw_lines = [_clean_line(line) for line in str(page_text or "").splitlines()]
    lines = [line for line in raw_lines if line]
    if not lines:
        return ""

    collected: list[str] = []
    in_question_section = False
    for line in lines:
        if _is_question_header(line):
            in_question_section = True
            collected.append("QUESTIONS")
            continue
        if not in_question_section and not _looks_like_question_start(line) and "?" not in line:
            continue
        collected.append(line)

    if not collected:
        return ""
    return "\n".join(collected).strip()


def _split_layout_columns(page_text: str) -> tuple[str, str]:
    left_lines: list[str] = []
    right_lines: list[str] = []
    for raw_line in str(page_text or "").splitlines():
        line = raw_line.rstrip()
        if not line.strip():
            continue
        parts = re.split(r"\s{6,}", line, maxsplit=1)
        if len(parts) == 2:
            left, right = (_clean_line(parts[0]), _clean_line(parts[1]))
            if left:
                left_lines.append(left)
            if right:
                right_lines.append(right)
            continue
        cleaned = _clean_line(line)
        if cleaned:
            left_lines.append(cleaned)
    return ("\n".join(left_lines).strip(), "\n".join(right_lines).strip())


def _extract_page_texts_from_pdf(pdf_bytes: bytes, expected_page_count: int) -> list[str]:
    reader = PdfReader(BytesIO(pdf_bytes))
    page_texts: list[str] = []
    for page in reader.pages:
        try:
            text = page.extract_text(extraction_mode="layout") or ""
        except TypeError:
            text = page.extract_text() or ""
        left_text, right_text = _split_layout_columns(text)
        left_section = _extract_question_section_text(left_text)
        right_section = _extract_question_section_text(right_text)
        if left_section and right_section:
            page_texts.append(f"{left_section}\n\n{right_section}")
        else:
            page_texts.append(_extract_question_section_text(text))
    if expected_page_count and len(page_texts) < expected_page_count:
        page_texts.extend([""] * (expected_page_count - len(page_texts)))
    return page_texts[:expected_page_count] if expected_page_count else page_texts


def _page_texts_usable(page_texts: list[str]) -> bool:
    joined = "\n".join(page_texts).strip()
    if not joined:
        return False
    alpha_count = sum(1 for char in joined if char.isalpha())
    replacement_count = joined.count("\x01")
    return alpha_count >= 40 and replacement_count < max(10, len(joined) // 20)


def _extract_error_message(response: requests.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return response.text.strip() or "OpenAI request failed"
    error = payload.get("error")
    if isinstance(error, dict) and error.get("message"):
        return str(error["message"])
    return response.text.strip() or "OpenAI request failed"


def _extract_output_text(response_json: dict[str, Any]) -> str:
    output_text = response_json.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text

    output = response_json.get("output") or []
    fragments: list[str] = []
    for item in output:
        if not isinstance(item, dict):
            continue
        content = item.get("content") or []
        for part in content:
            if not isinstance(part, dict):
                continue
            if part.get("type") == "output_text":
                text = part.get("text")
                if isinstance(text, str) and text.strip():
                    fragments.append(text)
    return "\n".join(fragments).strip()


def _parse_page_questions(response_json: dict[str, Any], page_count: int) -> list[list[dict[str, Any]]]:
    content = _extract_output_text(response_json)
    if not content:
        raise RuntimeError("OpenAI returned empty content")
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise RuntimeError("OpenAI returned invalid JSON for PDF questions") from exc
    if not isinstance(parsed, dict):
        raise RuntimeError("OpenAI returned an unexpected JSON payload")

    raw_pages = parsed.get("pages")
    if not isinstance(raw_pages, list):
        raise RuntimeError("OpenAI response did not include a pages array")

    page_questions: list[list[dict[str, Any]]] = [[] for _ in range(page_count)]
    for raw_page in raw_pages:
        if not isinstance(raw_page, dict):
            continue
        try:
            page_number = int(raw_page.get("pageNumber"))
        except (TypeError, ValueError):
            continue
        if page_number < 1 or page_number > page_count:
            continue
        raw_questions = raw_page.get("questions")
        if not isinstance(raw_questions, list):
            continue
        cleaned_items: list[dict[str, Any]] = []
        for raw_question in raw_questions:
            if not isinstance(raw_question, dict):
                continue
            question_text = str(raw_question.get("question") or "").strip()
            if not question_text:
                continue
            answer_options = raw_question.get("answerOptions")
            cleaned_items.append(
                {
                    "label": str(raw_question.get("label") or "").strip(),
                    "question": question_text,
                    "answerOptions": [
                        str(option).strip()
                        for option in (answer_options if isinstance(answer_options, list) else [])
                        if str(option).strip()
                    ],
                }
            )
        page_questions[page_number - 1] = cleaned_items
    return page_questions


def _parse_page_text_preview(response_json: dict[str, Any], page_count: int) -> list[str]:
    content = _extract_output_text(response_json)
    if not content:
        raise RuntimeError("OpenAI returned empty content")
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise RuntimeError("OpenAI returned invalid JSON for page text preview") from exc
    if not isinstance(parsed, dict):
        raise RuntimeError("OpenAI returned an unexpected JSON payload")
    raw_pages = parsed.get("pages")
    if not isinstance(raw_pages, list):
        raise RuntimeError("OpenAI response did not include a pages array")

    page_texts = [""] * page_count
    for raw_page in raw_pages:
        if not isinstance(raw_page, dict):
            continue
        try:
            page_number = int(raw_page.get("pageNumber"))
        except (TypeError, ValueError):
            continue
        if page_number < 1 or page_number > page_count:
            continue
        text = _clean_line(str(raw_page.get("text") or ""))
        if text:
            page_texts[page_number - 1] = text
    return page_texts


def _build_usage_payload(
    response_json: dict[str, Any], settings: Settings, model: str
) -> dict[str, Any]:
    usage = response_json.get("usage") or {}
    input_tokens = int(usage.get("input_tokens") or usage.get("prompt_tokens") or 0)
    output_tokens = int(usage.get("output_tokens") or usage.get("completion_tokens") or 0)
    total_tokens = int(usage.get("total_tokens") or (input_tokens + output_tokens))
    input_details = usage.get("input_tokens_details") or usage.get("prompt_tokens_details") or {}
    cached_input_tokens = int(input_details.get("cached_tokens") or 0)
    uncached_input_tokens = max(input_tokens - cached_input_tokens, 0)

    input_cost = (
        uncached_input_tokens
        * settings.openai_question_extraction_input_price_per_million
        / 1_000_000
    )
    cached_input_cost = (
        cached_input_tokens
        * settings.openai_question_extraction_cached_input_price_per_million
        / 1_000_000
    )
    output_cost = (
        output_tokens
        * settings.openai_question_extraction_output_price_per_million
        / 1_000_000
    )
    total_cost_usd = input_cost + cached_input_cost + output_cost

    return {
        "model": response_json.get("model") or model,
        "inputTokens": input_tokens,
        "outputTokens": output_tokens,
        "totalTokens": total_tokens,
        "cachedInputTokens": cached_input_tokens,
        "uncachedInputTokens": uncached_input_tokens,
        "inputCostUsd": input_cost,
        "cachedInputCostUsd": cached_input_cost,
        "outputCostUsd": output_cost,
        "costUsd": total_cost_usd,
        "costCents": total_cost_usd * 100,
    }


def _upload_pdf_to_openai(
    *,
    pdf_bytes: bytes,
    filename: str,
    settings: Settings,
) -> tuple[str, str | None]:
    _trace(f"file.upload.start filename={filename} bytes={len(pdf_bytes)}")
    try:
        response = requests.post(
            "https://api.openai.com/v1/files",
            headers=_openai_headers(settings, json_content=False),
            data={"purpose": "user_data"},
            files={"file": (filename, pdf_bytes, "application/pdf")},
            timeout=settings.openai_timeout_seconds,
        )
    except requests.RequestException as exc:
        _trace(f"file.upload.network_error filename={filename} error={exc}")
        logger.exception("[OPENAI] file.upload.network_error filename=%s", filename)
        raise RuntimeError(f"OpenAI file upload network error: {exc}") from exc
    _trace(
        "file.upload.response "
        f"status={response.status_code} request_id={response.headers.get('x-request-id', '')}"
    )
    if not response.ok:
        raise RuntimeError(_extract_error_message(response))
    payload = response.json()
    file_id = str(payload.get("id") or "").strip()
    if not file_id:
        raise RuntimeError("OpenAI file upload did not return a file id")
    _trace(f"file.upload.success file_id={file_id}")
    return file_id, response.headers.get("x-request-id")


def _delete_openai_file(file_id: str, settings: Settings) -> None:
    try:
        response = requests.delete(
            f"https://api.openai.com/v1/files/{file_id}",
            headers=_openai_headers(settings, json_content=False),
            timeout=settings.openai_timeout_seconds,
        )
    except requests.RequestException:
        _trace(f"file.delete.network_error file_id={file_id}")
        logger.exception("[OPENAI] file.delete.network_error file_id=%s", file_id)
        return
    _trace(f"file.delete.response file_id={file_id} status={response.status_code}")


def extract_questions_from_pdf_file(
    *,
    pdf_bytes: bytes,
    filename: str,
    page_count: int,
    email: str,
    settings: Settings,
    skill_prompt: str | None = None,
) -> dict[str, Any]:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured on the server")
    if page_count < 1:
        raise RuntimeError("page_count must be at least 1")

    model = settings.openai_question_extraction_model
    user_hash = hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()
    page_texts = _extract_page_texts_from_pdf(pdf_bytes, page_count)
    extraction_prompt = skill_prompt or _DEFAULT_SKILL_PROMPT
    use_text_mode = _page_texts_usable(page_texts)
    _trace(
        f"text.extract.success filename={filename} pages={len(page_texts)} "
        f"non_empty_pages={sum(1 for text in page_texts if text.strip())} usable={use_text_mode}"
    )

    upload_request_id = None
    file_id = None
    if use_text_mode:
        payload = {
            "model": model,
            "input": [
                {
                    "role": "system",
                    "content": [{"type": "input_text", "text": _SYSTEM_PROMPT}],
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": (
                                f"{extraction_prompt}\n\n"
                                "Extract student-facing questions from this page text. "
                                "The source is from a two-column textbook page and the question section starts at the heading QUESTIONS. "
                                "Read each page in natural textbook order: complete the left column first, then continue with the right column. "
                                f"Return valid JSON only in the shape "
                                f'{{"pages":[{{"pageNumber":1,"questions":[{{"label":"","question":"","answerOptions":[]}}]}}]}}. '
                                f"Include every page from 1 to {page_count}. "
                                "Use an empty questions array when a page has no readable questions. "
                                "Do not include explanation or markdown.\n\n"
                                f"{json.dumps({'pages': [{'pageNumber': index + 1, 'text': page_texts[index]} for index in range(page_count)]}, ensure_ascii=True)}"
                            ),
                        },
                    ],
                },
            ],
            "user": user_hash,
        }
        _trace(f"response.start model={model} mode=text page_count={page_count}")
    else:
        file_id, upload_request_id = _upload_pdf_to_openai(
            pdf_bytes=pdf_bytes,
            filename=filename,
            settings=settings,
        )
        payload = {
            "model": model,
            "input": [
                {
                    "role": "system",
                    "content": [{"type": "input_text", "text": _SYSTEM_PROMPT}],
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": (
                                f"{extraction_prompt}\n\n"
                                "Extract student-facing questions from this PDF. "
                                "This textbook uses multi-column layout. Read each page in natural textbook order: complete the left column first, then continue with the right column. "
                                "The question section begins at the heading QUESTIONS. "
                                f"Return valid JSON only in the shape "
                                f'{{"pages":[{{"pageNumber":1,"questions":[{{"label":"","question":"","answerOptions":[]}}]}}]}}. '
                                f"Include every page from 1 to {page_count}. "
                                "Use an empty questions array when a page has no readable questions. "
                                "Do not include explanation or markdown."
                            ),
                        },
                        {
                            "type": "input_file",
                            "file_id": file_id,
                        },
                    ],
                },
            ],
            "user": user_hash,
        }
        _trace(f"response.start model={model} mode=file file_id={file_id} page_count={page_count}")
    try:
        response = requests.post(
            _OPENAI_RESPONSES_URL,
            headers=_openai_headers(settings, json_content=True),
            json=payload,
            timeout=settings.openai_timeout_seconds,
        )
    except requests.RequestException as exc:
        _trace(f"response.network_error model={model} mode={'text' if use_text_mode else 'file'} error={exc}")
        logger.exception("[OPENAI] response.network_error model=%s", model)
        if file_id:
            _delete_openai_file(file_id, settings)
        raise RuntimeError(f"OpenAI network error: {exc}") from exc

    _trace(
        "response.received "
        f"model={model} status={response.status_code} request_id={response.headers.get('x-request-id', '')}"
    )
    if not response.ok:
        if file_id:
            _delete_openai_file(file_id, settings)
        raise RuntimeError(_extract_error_message(response))

    response_json = response.json()
    page_question_details = _parse_page_questions(response_json, page_count)
    usage = _build_usage_payload(response_json, settings, model)
    _trace(
        "response.success "
        f"model={usage['model']} pages={page_count} input_tokens={usage['inputTokens']} "
        f"output_tokens={usage['outputTokens']} total_tokens={usage['totalTokens']} "
        f"cost_cents={usage['costCents']:.4f}"
    )
    if file_id:
        _delete_openai_file(file_id, settings)

    return {
        "pageQuestions": [
            "\n\n".join(
                [
                    "\n".join(
                        [f"{item['label']} {item['question']}".strip(), *item["answerOptions"]]
                    ).strip()
                    for item in questions
                ]
            )
            for questions in page_question_details
        ],
        "pageQuestionDetails": page_question_details,
        "usage": usage,
        "pageCount": page_count,
        "requestId": response.headers.get("x-request-id"),
        "uploadRequestId": upload_request_id,
        "fileId": file_id,
    }


def preview_question_text_from_pdf(
    *,
    pdf_bytes: bytes,
    filename: str,
    page_count: int,
    settings: Settings,
) -> dict[str, Any]:
    debug_dir = (
        Path(__file__).resolve().parents[2]
        / "logs"
        / "ocr_preview"
        / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    )
    _trace(f"text.preview.ocr.start filename={filename} debug_dir={debug_dir}")
    page_texts = extract_pdf_text_by_columns(
        pdf_bytes=pdf_bytes,
        page_count=page_count,
        debug_dir=str(debug_dir),
        trace=lambda message: _trace(message),
    )
    _trace(
        f"text.preview.success filename={filename} pages={len(page_texts)} non_empty_pages={sum(1 for text in page_texts if text.strip())}"
    )
    return {
        "pageTexts": page_texts,
        "pageCount": page_count,
    }
