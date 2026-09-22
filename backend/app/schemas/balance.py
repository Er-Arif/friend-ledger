from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class BalancePersonRead(BaseModel):
    user_id: UUID
    display_name: str
    username: str
    upi_id: str | None = None


class BalanceItem(BaseModel):
    person: BalancePersonRead
    direction: Literal["I_OWE", "OWED_TO_ME"]
    amount_minor: int


class BalanceSummaryResponse(BaseModel):
    total_i_owe_minor: int
    total_owed_to_me_minor: int
    items: list[BalanceItem]


class PairwiseBalanceResponse(BaseModel):
    person: BalancePersonRead
    direction: Literal["I_OWE", "OWED_TO_ME", "SETTLED"]
    amount_minor: int
    counterparty_upi_id: str | None = None


class LedgerEntry(BaseModel):
    source_type: Literal["PAYMENT", "SETTLEMENT"]

    payment_id: UUID | None = None
    settlement_id: UUID | None = None
    session_id: UUID | None = None

    description: str
    created_at: datetime

    direction: Literal[
        "I_OWE",
        "OWED_TO_ME",
        "SETTLED_BY_ME",
        "SETTLED_TO_ME",
    ]

    amount_minor: int
    method: Literal["CASH", "UPI", "OTHER"] | None = None


class PairwiseLedgerResponse(BaseModel):
    person: BalancePersonRead
    balance: PairwiseBalanceResponse
    entries: list[LedgerEntry]