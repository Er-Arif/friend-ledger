from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
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
    from app.models.session_participation import SessionParticipation
    from app.models.user import User


class OutingSession(Base):
    __tablename__ = "sessions"

    __table_args__ = (
        CheckConstraint(
            "name IS NULL OR length(btrim(name)) > 0",
            name="name_not_blank",
        ),
        CheckConstraint(
            "status IN ('ACTIVE', 'CLOSED')",
            name="status_valid",
        ),
        CheckConstraint(
            "("
            "status = 'ACTIVE' AND closed_at IS NULL"
            ") OR ("
            "status = 'CLOSED' AND closed_at IS NOT NULL"
            ")",
            name="status_closed_at_consistent",
        ),
        Index("ix_sessions_status", "status"),
        Index("ix_sessions_created_at", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    name: Mapped[str | None] = mapped_column(
        String(80),
        nullable=True,
    )

    join_code: Mapped[str] = mapped_column(
        String(8),
        nullable=False,
        unique=True,
    )

    created_by_user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="ACTIVE",
        server_default=text("'ACTIVE'"),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    creator: Mapped[User] = relationship(
        back_populates="created_sessions",
    )

    participations: Mapped[list[SessionParticipation]] = relationship(
        back_populates="session",
    )