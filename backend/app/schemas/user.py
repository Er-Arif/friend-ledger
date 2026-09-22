import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

UPI_REGEX = re.compile(r"^[a-zA-Z0-9.\-_]{2,100}@[a-zA-Z0-9.\-_]{2,50}$")


def validate_upi_id(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    if " " in trimmed:
        raise ValueError("UPI ID cannot contain spaces.")
    if len(trimmed) < 3 or len(trimmed) > 128:
        raise ValueError("UPI ID must be between 3 and 128 characters.")
    if not UPI_REGEX.match(trimmed):
        raise ValueError("Invalid UPI ID format. Expected format: username@bank.")
    parts = trimmed.split("@", 1)
    return f"{parts[0]}@{parts[1].lower()}"


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_name: str
    username: str
    upi_id: str | None = None
    created_at: datetime


class UserUpiUpdateRequest(BaseModel):
    upi_id: str | None = None

    @field_validator("upi_id", mode="before")
    @classmethod
    def validate_upi(cls, value: str | None) -> str | None:
        return validate_upi_id(value)