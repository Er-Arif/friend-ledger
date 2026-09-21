from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SettlementCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    to_user_id: UUID
    amount_minor: int = Field(gt=0)
    method: Literal["CASH", "UPI", "OTHER"]

    note: str | None = Field(
        default=None,
        max_length=250,
    )


class SettlementVoidRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    reason: str | None = Field(
        default=None,
        max_length=250,
    )


class SettlementUserRead(BaseModel):
    user_id: UUID
    display_name: str
    username: str


class SettlementRead(BaseModel):
    id: UUID

    from_user: SettlementUserRead
    to_user: SettlementUserRead

    amount_minor: int
    method: str
    note: str | None

    status: str

    created_at: datetime
    voided_at: datetime | None
    void_reason: str | None