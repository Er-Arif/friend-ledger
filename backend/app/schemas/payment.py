from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CustomShareInput(BaseModel):
    user_id: UUID
    amount_minor: int = Field(gt=0)


class PaymentCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    description: str = Field(
        min_length=1,
        max_length=120,
    )

    total_amount_minor: int = Field(gt=0)

    split_type: Literal["EQUAL", "CUSTOM"]

    participant_user_ids: list[UUID] | None = None
    custom_shares: list[CustomShareInput] | None = None

    @model_validator(mode="after")
    def validate_split_input(self) -> "PaymentCreateRequest":
        if self.split_type == "EQUAL":
            if not self.participant_user_ids:
                raise ValueError(
                    "participant_user_ids is required for EQUAL split."
                )

            if self.custom_shares:
                raise ValueError(
                    "custom_shares must not be supplied for EQUAL split."
                )

            if len(set(self.participant_user_ids)) != len(
                self.participant_user_ids
            ):
                raise ValueError(
                    "participant_user_ids must be unique."
                )

        if self.split_type == "CUSTOM":
            if not self.custom_shares:
                raise ValueError(
                    "custom_shares is required for CUSTOM split."
                )

            if self.participant_user_ids:
                raise ValueError(
                    "participant_user_ids must not be supplied "
                    "for CUSTOM split."
                )

            user_ids = [
                share.user_id
                for share in self.custom_shares
            ]

            if len(set(user_ids)) != len(user_ids):
                raise ValueError(
                    "custom share users must be unique."
                )

        return self


class PaymentVoidRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    reason: str | None = Field(
        default=None,
        max_length=250,
    )


class PaymentUserRead(BaseModel):
    user_id: UUID
    display_name: str
    username: str


class PaymentShareRead(BaseModel):
    user_id: UUID
    display_name: str
    username: str
    amount_minor: int


class PaymentRead(BaseModel):
    id: UUID
    session_id: UUID

    payer: PaymentUserRead

    description: str
    total_amount_minor: int
    split_type: str
    status: str

    corrected_from_payment_id: UUID | None

    created_at: datetime
    voided_at: datetime | None
    void_reason: str | None

    shares: list[PaymentShareRead]


class PaymentListResponse(BaseModel):
    items: list[PaymentRead]