from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, Index, String, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.session import OutingSession
    from app.models.session_participation import SessionParticipation


class User(Base):
    __tablename__ = "users"

    __table_args__ = (
        CheckConstraint(
            "length(btrim(display_name)) > 0",
            name="display_name_not_blank",
        ),
        CheckConstraint(
            "length(btrim(username_normalized)) > 0",
            name="username_normalized_not_blank",
        ),
        CheckConstraint(
            "status IN ('ACTIVE', 'DISABLED')",
            name="status_valid",
        ),
        Index("ix_users_status", "status"),
        Index("ix_users_created_at", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    display_name: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
    )

    username: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
    )

    username_normalized: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        unique=True,
    )

    password_hash: Mapped[str] = mapped_column(
        Text,
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

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    created_sessions: Mapped[list[OutingSession]] = relationship(
        back_populates="creator",
    )

    participations: Mapped[list[SessionParticipation]] = relationship(
        back_populates="user",
    )