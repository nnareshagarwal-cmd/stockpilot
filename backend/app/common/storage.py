import os
import uuid
from pathlib import Path
from fastapi import UploadFile
from app.config import settings

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024  # Convert to bytes


async def save_upload(
    file: UploadFile,
    subdirectory: str,
    allowed_types: set = ALLOWED_IMAGE_TYPES,
) -> dict:
    """Save an uploaded file and return metadata."""
    if file.content_type not in allowed_types:
        raise ValueError(f"File type {file.content_type} not allowed. Allowed types: {', '.join(allowed_types)}")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise ValueError(f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")

    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
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
        "mime_type": file.content_type,
    }


async def delete_file(file_url: str):
    """Delete a file by its URL path."""
    rel_path = file_url.lstrip("/")
    if rel_path.startswith("uploads/"):
        rel_path = rel_path[len("uploads/"):]
    file_path = Path(settings.UPLOAD_DIR) / rel_path
    if file_path.exists():
        os.remove(file_path)
