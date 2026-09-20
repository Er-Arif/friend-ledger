from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SessionCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(
        default=None,
        max_length=80,
    )

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None

        value = value.strip()

        return value or None


class SessionJoinRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    join_code: str = Field(
        min_length=1,
        max_length=8,
    )


class ParticipantRead(BaseModel):
    user_id: UUID
    display_name: str
    username: str
    joined_at: datetime


class CurrentUserSessionState(BaseModel):
    is_active: bool


class SessionCreateResponse(BaseModel):
    id: UUID
    name: str | None
    join_code: str
    status: str
    created_at: datetime
    current_user: CurrentUserSessionState


class SessionBasicRead(BaseModel):
    id: UUID
    name: str | None
    status: str


class ParticipationRead(BaseModel):
    id: UUID
    joined_at: datetime


class SessionJoinResponse(BaseModel):
    session: SessionBasicRead
    participation: ParticipationRead


class SessionDetailResponse(BaseModel):
    id: UUID
    name: str | None
    join_code: str | None
    status: str
    created_at: datetime
    closed_at: datetime | None

    active_participants: list[ParticipantRead]

    current_user: CurrentUserSessionState


class SessionListItem(BaseModel):
    id: UUID
    name: str | None
    status: str
    created_at: datetime
    closed_at: datetime | None

    active_participant_count: int
    current_user_is_active: bool


class SessionListResponse(BaseModel):
    items: list[SessionListItem]


class SessionLeaveResponse(BaseModel):
    session_id: UUID
    left_at: datetime
    session_status: str


class SessionFinishResponse(BaseModel):
    session_id: UUID
    status: str
    closed_at: datetime