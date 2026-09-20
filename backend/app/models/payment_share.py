from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.payment import Payment
    from app.models.user import User


class PaymentShare(Base):
    __tablename__ = "payment_shares"

    __table_args__ = (
        CheckConstraint(
            "amount_minor > 0",
            name="amount_positive",
        ),
        UniqueConstraint(
            "payment_id",
            "user_id",
            name="uq_payment_shares_payment_user",
        ),
        Index(
            "ix_payment_shares_payment_id",
            "payment_id",
        ),
        Index(
            "ix_payment_shares_user_id",
            "user_id",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    payment_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("payments.id", ondelete="RESTRICT"),
        nullable=False,
    )

    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    amount_minor: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    payment: Mapped[Payment] = relationship(
        back_populates="shares",
    )

    user: Mapped[User] = relationship(
        back_populates="payment_shares",
    )