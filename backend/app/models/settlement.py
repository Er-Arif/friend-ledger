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
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class Settlement(Base):
    __tablename__ = "settlements"

    __table_args__ = (
        CheckConstraint(
            "amount_minor > 0",
            name="amount_positive",
        ),
        CheckConstraint(
            "from_user_id <> to_user_id",
            name="different_users",
        ),
        CheckConstraint(
            "method IN ('CASH', 'UPI', 'OTHER')",
            name="method_valid",
        ),
        CheckConstraint(
            "status IN ('ACTIVE', 'VOIDED')",
            name="status_valid",
        ),
        CheckConstraint(
            """
            (
                status = 'ACTIVE'
                AND voided_at IS NULL
                AND voided_by_user_id IS NULL
            )
            OR
            (
                status = 'VOIDED'
                AND voided_at IS NOT NULL
                AND voided_by_user_id IS NOT NULL
            )
            """,
            name="void_state_consistent",
        ),
        Index(
            "ix_settlements_from_to_created_at",
            "from_user_id",
            "to_user_id",
            "created_at",
        ),
        Index(
            "ix_settlements_to_from_created_at",
            "to_user_id",
            "from_user_id",
            "created_at",
        ),
        Index(
            "ix_settlements_status",
            "status",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    from_user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )

    to_user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )

    amount_minor: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    method: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    note: Mapped[str | None] = mapped_column(
        String(250),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default=text("'ACTIVE'"),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    voided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    voided_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "users.id",
            ondelete="RESTRICT",
        ),
        nullable=True,
    )

    void_reason: Mapped[str | None] = mapped_column(
        String(250),
        nullable=True,
    )

    from_user: Mapped["User"] = relationship(
        foreign_keys=[from_user_id],
    )

    to_user: Mapped["User"] = relationship(
        foreign_keys=[to_user_id],
    )

    voided_by_user: Mapped["User | None"] = relationship(
        foreign_keys=[voided_by_user_id],
    )