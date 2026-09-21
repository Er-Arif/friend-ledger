import secrets
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.models.session import OutingSession
from app.models.session_participation import SessionParticipation
from app.models.user import User

JOIN_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
JOIN_CODE_LENGTH = 6


def normalize_join_code(value: str) -> str:
    return value.strip().upper()


def generate_join_code() -> str:
    return "".join(
        secrets.choice(JOIN_CODE_ALPHABET)
        for _ in range(JOIN_CODE_LENGTH)
    )


def create_unique_join_code(db: Session) -> str:
    for _ in range(20):
        code = generate_join_code()

        existing = db.scalar(
            select(OutingSession.id).where(
                OutingSession.join_code == code
            )
        )

        if existing is None:
            return code

    raise RuntimeError(
        "Unable to generate a unique join code"
    )


def create_outing(
    db: Session,
    *,
    user: User,
    name: str | None,
) -> tuple[
    OutingSession,
    SessionParticipation,
]:
    outing = OutingSession(
        name=name,
        join_code=create_unique_join_code(db),
        created_by_user_id=user.id,
    )

    db.add(outing)
    db.flush()

    participation = SessionParticipation(
        session_id=outing.id,
        user_id=user.id,
    )

    db.add(participation)
    db.flush()

    db.refresh(outing)
    db.refresh(participation)

    return outing, participation


def join_outing(
    db: Session,
    *,
    user: User,
    join_code: str,
) -> tuple[
    OutingSession,
    SessionParticipation,
]:
    normalized_code = normalize_join_code(
        join_code
    )

    outing = db.scalar(
        select(OutingSession)
        .where(
            OutingSession.join_code
            == normalized_code
        )
        .with_for_update()
    )

    if outing is None:
        raise AppError(
            code="INVALID_JOIN_CODE",
            message="This outing code is invalid.",
            status_code=404,
        )

    if outing.status != "ACTIVE":
        raise AppError(
            code="SESSION_CLOSED",
            message="This outing has already ended.",
            status_code=409,
        )

    active_participation = db.scalar(
        select(SessionParticipation).where(
            SessionParticipation.session_id
            == outing.id,
            SessionParticipation.user_id
            == user.id,
            SessionParticipation.left_at.is_(None),
        )
    )

    if active_participation is not None:
        raise AppError(
            code="ALREADY_ACTIVE_PARTICIPANT",
            message=(
                "You are already participating "
                "in this outing."
            ),
            status_code=409,
        )

    participation = SessionParticipation(
        session_id=outing.id,
        user_id=user.id,
    )

    try:
        with db.begin_nested():
            db.add(participation)
            db.flush()

    except IntegrityError as exc:
        active_participation = db.scalar(
            select(SessionParticipation).where(
                SessionParticipation.session_id
                == outing.id,
                SessionParticipation.user_id
                == user.id,
                SessionParticipation.left_at.is_(
                    None
                ),
            )
        )

        if active_participation is not None:
            raise AppError(
                code=(
                    "ALREADY_ACTIVE_PARTICIPANT"
                ),
                message=(
                    "You are already participating "
                    "in this outing."
                ),
                status_code=409,
            ) from exc

        raise AppError(
            code="SESSION_JOIN_CONFLICT",
            message=(
                "The outing could not be joined "
                "because of a concurrent change."
            ),
            status_code=409,
        ) from exc

    db.refresh(participation)

    return outing, participation


def has_participated(
    db: Session,
    *,
    session_id: UUID,
    user_id: UUID,
) -> bool:
    participation_id = db.scalar(
        select(SessionParticipation.id)
        .where(
            SessionParticipation.session_id
            == session_id,
            SessionParticipation.user_id
            == user_id,
        )
        .limit(1)
    )

    return participation_id is not None


def get_outing_for_user(
    db: Session,
    *,
    session_id: UUID,
    user: User,
) -> OutingSession:
    outing = db.get(
        OutingSession,
        session_id,
    )

    if outing is None or not has_participated(
        db,
        session_id=session_id,
        user_id=user.id,
    ):
        raise AppError(
            code="SESSION_NOT_FOUND",
            message="Outing not found.",
            status_code=404,
        )

    return outing


def is_active_participant(
    db: Session,
    *,
    session_id: UUID,
    user_id: UUID,
) -> bool:
    participation_id = db.scalar(
        select(SessionParticipation.id).where(
            SessionParticipation.session_id
            == session_id,
            SessionParticipation.user_id
            == user_id,
            SessionParticipation.left_at.is_(None),
        )
    )

    return participation_id is not None


def get_active_participants(
    db: Session,
    *,
    session_id: UUID,
) -> list[
    tuple[
        SessionParticipation,
        User,
    ]
]:
    result = db.execute(
        select(
            SessionParticipation,
            User,
        )
        .join(
            User,
            User.id
            == SessionParticipation.user_id,
        )
        .where(
            SessionParticipation.session_id
            == session_id,
            SessionParticipation.left_at.is_(None),
        )
        .order_by(
            SessionParticipation.joined_at.asc(),
            User.id.asc(),
        )
    )

    return list(result.all())


def count_active_participants(
    db: Session,
    *,
    session_id: UUID,
) -> int:
    count = db.scalar(
        select(func.count())
        .select_from(SessionParticipation)
        .where(
            SessionParticipation.session_id
            == session_id,
            SessionParticipation.left_at.is_(None),
        )
    )

    return int(count or 0)


def list_user_outings(
    db: Session,
    *,
    user: User,
) -> list[OutingSession]:
    outings = db.scalars(
        select(OutingSession)
        .join(
            SessionParticipation,
            SessionParticipation.session_id
            == OutingSession.id,
        )
        .where(
            SessionParticipation.user_id
            == user.id,
        )
        .distinct()
        .order_by(
            OutingSession.created_at.desc()
        )
    )

    return list(outings)


def leave_outing(
    db: Session,
    *,
    session_id: UUID,
    user: User,
) -> tuple[
    SessionParticipation,
    OutingSession,
]:
    outing = db.scalar(
        select(OutingSession)
        .where(
            OutingSession.id == session_id
        )
        .with_for_update()
    )

    if outing is None:
        raise AppError(
            code="SESSION_NOT_FOUND",
            message="Outing not found.",
            status_code=404,
        )

    if outing.status != "ACTIVE":
        raise AppError(
            code="SESSION_CLOSED",
            message="This outing has already ended.",
            status_code=409,
        )

    participation = db.scalar(
        select(SessionParticipation)
        .where(
            SessionParticipation.session_id
            == session_id,
            SessionParticipation.user_id
            == user.id,
            SessionParticipation.left_at.is_(None),
        )
        .with_for_update()
    )

    if participation is None:
        raise AppError(
            code="NOT_ACTIVE_PARTICIPANT",
            message=(
                "You are not currently "
                "participating in this outing."
            ),
            status_code=409,
        )

    now = datetime.now(UTC)

    participation.left_at = now

    db.flush()

    remaining = count_active_participants(
        db,
        session_id=session_id,
    )

    if remaining == 0:
        outing.status = "CLOSED"
        outing.closed_at = now

    db.flush()

    db.refresh(participation)
    db.refresh(outing)

    return participation, outing


def finish_outing(
    db: Session,
    *,
    session_id: UUID,
    user: User,
) -> OutingSession:
    outing = db.scalar(
        select(OutingSession)
        .where(
            OutingSession.id == session_id
        )
        .with_for_update()
    )

    if outing is None:
        raise AppError(
            code="SESSION_NOT_FOUND",
            message="Outing not found.",
            status_code=404,
        )

    if outing.status != "ACTIVE":
        raise AppError(
            code="SESSION_CLOSED",
            message="This outing has already ended.",
            status_code=409,
        )

    participation = db.scalar(
        select(SessionParticipation)
        .where(
            SessionParticipation.session_id
            == session_id,
            SessionParticipation.user_id
            == user.id,
            SessionParticipation.left_at.is_(None),
        )
        .with_for_update()
    )

    if participation is None:
        raise AppError(
            code="NOT_ACTIVE_PARTICIPANT",
            message=(
                "You are not currently "
                "participating in this outing."
            ),
            status_code=409,
        )

    active_count = count_active_participants(
        db,
        session_id=session_id,
    )

    if active_count != 1:
        raise AppError(
            code="SESSION_FINISH_NOT_ALLOWED",
            message=(
                "This outing can only be finished "
                "when you are the final active "
                "participant."
            ),
            status_code=409,
        )

    now = datetime.now(UTC)

    participation.left_at = now
    outing.status = "CLOSED"
    outing.closed_at = now

    db.flush()

    db.refresh(participation)
    db.refresh(outing)

    return outing