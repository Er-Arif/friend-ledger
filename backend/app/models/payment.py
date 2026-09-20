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
    String,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.payment_share import PaymentShare
    from app.models.session import OutingSession
    from app.models.user import User


class Payment(Base):
    __tablename__ = "payments"

    __table_args__ = (
        CheckConstraint(
            "total_amount_minor > 0",
            name="total_amount_positive",
        ),
        CheckConstraint(
            "split_type IN ('EQUAL', 'CUSTOM')",
            name="split_type_valid",
        ),
        CheckConstraint(
            "status IN ('ACTIVE', 'VOIDED')",
            name="status_valid",
        ),
        CheckConstraint(
            "("
            "status = 'ACTIVE' "
            "AND voided_at IS NULL "
            "AND voided_by_user_id IS NULL"
            ") OR ("
            "status = 'VOIDED' "
            "AND voided_at IS NOT NULL "
            "AND voided_by_user_id IS NOT NULL"
            ")",
            name="void_state_consistent",
        ),
        Index(
            "ix_payments_session_created_at",
            "session_id",
            "created_at",
        ),
        Index(
            "ix_payments_payer_created_at",
            "payer_user_id",
            "created_at",
        ),
        Index(
            "ix_payments_status",
            "status",
        ),
        Index(
            "ix_payments_corrected_from",
            "corrected_from_payment_id",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    session_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("sessions.id", ondelete="RESTRICT"),
        nullable=False,
    )

    payer_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )

    total_amount_minor: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    split_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="ACTIVE",
        server_default=text("'ACTIVE'"),
    )

    corrected_from_payment_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("payments.id", ondelete="RESTRICT"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    voided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    voided_by_user_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )

    void_reason: Mapped[str | None] = mapped_column(
        String(250),
        nullable=True,
    )

    session: Mapped[OutingSession] = relationship(
        back_populates="payments",
    )

    payer: Mapped[User] = relationship(
        foreign_keys=[payer_user_id],
        back_populates="paid_payments",
    )

    shares: Mapped[list[PaymentShare]] = relationship(
        back_populates="payment",
        cascade="all, delete-orphan",
    )