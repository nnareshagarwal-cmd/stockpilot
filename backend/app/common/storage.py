import io
import logging
import os
import uuid
from pathlib import Path
from fastapi import UploadFile
from app.config import settings

logger = logging.getLogger(__name__)

try:
    from PIL import Image, ImageOps
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024  # Convert to bytes


def optimize_image_bytes(
    content: bytes,
    mime_type: str,
    max_dimension: int = 1600,
    quality: int = 82,
) -> tuple[bytes, str, str]:
    """
    Optimizes and downscales large images using Pillow.
    - Transposes EXIF orientation automatically.
    - Scales down images larger than max_dimension preserving aspect ratio.
    - Converts and compresses to WebP (if transparent) or JPEG.
    - If already smaller than 350KB and within bounds, keeps original.
    Returns: (optimized_content, new_mime_type, file_extension)
    """
    default_ext = ".webp" if mime_type == "image/webp" else (".png" if mime_type == "image/png" else ".jpg")
    if not HAS_PILLOW or len(content) <= 350 * 1024:
        return content, mime_type, default_ext

    try:
        with Image.open(io.BytesIO(content)) as img:
            img = ImageOps.exif_transpose(img)
            width, height = img.size

            if width > max_dimension or height > max_dimension:
                img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

            out_buf = io.BytesIO()
            if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                img.save(out_buf, format="WEBP", quality=quality, method=4)
                return out_buf.getvalue(), "image/webp", ".webp"
            else:
                rgb_img = img.convert("RGB")
                rgb_img.save(out_buf, format="JPEG", quality=quality, optimize=True)
                return out_buf.getvalue(), "image/jpeg", ".jpg"
    except Exception as e:
        logger.warning(f"Could not optimize image with Pillow: {e}")
        return content, mime_type, default_ext


async def save_upload(
    file: UploadFile,
    subdirectory: str,
    allowed_types: set = ALLOWED_IMAGE_TYPES,
) -> dict:
    """Save an uploaded file, automatically optimizing oversized images, and return metadata."""
    if file.content_type not in allowed_types:
        raise ValueError(f"File type {file.content_type} not allowed. Allowed types: {', '.join(allowed_types)}")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise ValueError(f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")

    content, mime_type, ext = optimize_image_bytes(content, file.content_type)
    unique_name = f"{uuid.uuid4().hex}{ext}"

    upload_path = Path(settings.UPLOAD_DIR) / subdirectory
    upload_path.mkdir(parents=True, exist_ok=True)

    file_path = upload_path / unique_name
    with open(file_path, "wb") as f:
        f.write(content)

    return {
        "file_url": f"/uploads/{subdirectory}/{unique_name}".replace("\\", "/"),
        "file_name": file.filename or unique_name,
        "file_size": len(content),
        "mime_type": mime_type,
    }


async def delete_file(file_url: str):
    """Delete a file by its URL path."""
    rel_path = file_url.lstrip("/")
    if rel_path.startswith("uploads/"):
        rel_path = rel_path[len("uploads/"):]
    file_path = Path(settings.UPLOAD_DIR) / rel_path
    if file_path.exists():
        os.remove(file_path)
