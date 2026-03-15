from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import Callable

import fitz
import pytesseract
from PIL import Image, ImageFilter, ImageOps


TraceFn = Callable[[str], None]


def _render_page(page: fitz.Page, dpi: int) -> Image.Image:
    scale = dpi / 72.0
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    mode = "RGB" if pix.n < 4 else "RGBA"
    image = Image.frombytes(mode, [pix.width, pix.height], pix.samples)
    return image.convert("RGB") if mode == "RGBA" else image


def _preprocess_for_ocr(image: Image.Image) -> Image.Image:
    gray = ImageOps.grayscale(image)
    gray = gray.filter(ImageFilter.MedianFilter(size=3))
    gray = ImageOps.autocontrast(gray)
    return gray.point(lambda p: 255 if p > 185 else 0)


def _split_columns(image: Image.Image, columns: int, gutter_ratio: float) -> list[tuple[int, int, int, int]]:
    width, height = image.size
    if columns <= 1:
        return [(0, 0, width, height)]
    gutter = int(width * gutter_ratio)
    col_width = width / columns
    boxes: list[tuple[int, int, int, int]] = []
    for index in range(columns):
        left = int(round(index * col_width))
        right = int(round((index + 1) * col_width))
        if index > 0:
            left += gutter // 2
        if index < columns - 1:
            right -= gutter // 2
        boxes.append((max(0, left), 0, min(width, right), height))
    return boxes


def _collapse_blank_lines(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.rstrip(" \t") for line in text.split("\n")]
    collapsed = "\n".join(lines)
    while "\n\n\n" in collapsed:
        collapsed = collapsed.replace("\n\n\n", "\n\n")
    return collapsed.strip()


def _ocr_image(image: Image.Image, psm: int) -> str:
    config = f"--oem 3 --psm {psm}"
    return _collapse_blank_lines(pytesseract.image_to_string(image, config=config, lang="eng"))


def extract_pdf_text_by_columns(
    *,
    pdf_bytes: bytes,
    page_count: int,
    dpi: int = 220,
    columns: int = 2,
    gutter_ratio: float = 0.05,
    psm: int = 4,
    debug_dir: str | None = None,
    trace: TraceFn | None = None,
) -> list[str]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        results: list[str] = []
        for page_index in range(min(page_count, len(doc))):
            page = doc[page_index]
            base = _render_page(page, dpi=dpi)
            processed = _preprocess_for_ocr(base)
            boxes = _split_columns(processed, columns=columns, gutter_ratio=gutter_ratio)
            column_texts: list[str] = []
            page_no = page.number + 1
            if trace:
                trace(
                    f"OCR preview page={page_no} size={processed.size[0]}x{processed.size[1]} columns={len(boxes)}"
                )
            for column_index, box in enumerate(boxes, start=1):
                crop = processed.crop(box)
                text = _ocr_image(crop, psm=psm)
                column_texts.append(text)
                if debug_dir:
                    debug_path = Path(debug_dir)
                    debug_path.mkdir(parents=True, exist_ok=True)
                    crop.save(debug_path / f"page_{page_no:03d}_col_{column_index}.png")
                    (debug_path / f"page_{page_no:03d}_col_{column_index}.txt").write_text(
                        text,
                        encoding="utf-8",
                    )
                if trace:
                    trace(
                        f"OCR preview page={page_no} col={column_index} chars={len(text)} box={box}"
                    )
            combined = "\n\n".join(text for text in column_texts if text.strip()).strip()
            results.append(combined)
        while len(results) < page_count:
            results.append("")
        return results
    finally:
        doc.close()
