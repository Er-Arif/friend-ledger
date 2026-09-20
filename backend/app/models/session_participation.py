from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.session import OutingSession
    from app.models.user import User


class SessionParticipation(Base):
    __tablename__ = "session_participations"

    __table_args__ = (
        CheckConstraint(
            "left_at IS NULL OR left_at > joined_at",
            name="left_after_join",
        ),
        Index(
            "uq_session_participations_active_user",
            "session_id",
            "user_id",
            unique=True,
            postgresql_where=text("left_at IS NULL"),
        ),
        Index(
            "ix_session_participations_session_joined",
            "session_id",
            "joined_at",
        ),
        Index(
            "ix_session_participations_user_joined",
            "user_id",
            "joined_at",
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

    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    left_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    session: Mapped[OutingSession] = relationship(
        back_populates="participations",
    )

    user: Mapped[User] = relationship(
        back_populates="participations",
    )