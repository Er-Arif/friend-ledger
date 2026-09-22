from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.session import (
    CurrentUserSessionState,
    ParticipantRead,
    ParticipationRead,
    SessionBasicRead,
    SessionCreateRequest,
    SessionCreateResponse,
    SessionDetailResponse,
    SessionFinishResponse,
    SessionJoinRequest,
    SessionJoinResponse,
    SessionLeaveResponse,
    SessionListItem,
    SessionListResponse,
)
from app.services.audit import record_audit_event
from app.services.realtime import broadcast_event
from app.services.sessions import (
    count_active_participants,
    create_outing,
    finish_outing,
    get_active_participants,
    get_outing_for_user,
    is_active_participant,
    join_outing,
    leave_outing,
    list_user_outings,
)

router = APIRouter(
    prefix="/sessions",
    tags=["Outings"],
)


@router.post(
    "",
    response_model=SessionCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_session(
    payload: SessionCreateRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> SessionCreateResponse:
    outing, _participation = create_outing(
        db,
        user=current_user,
        name=payload.name,
    )
    record_audit_event(
    db,
    actor_user_id=current_user.id,
    event_type="SESSION_CREATED",
    entity_type="SESSION",
    entity_id=outing.id,
    session_id=outing.id,
    metadata={
        "name": outing.name,
    },
)

    db.commit()

    broadcast_event(
        [current_user.id],
        {
            "type": "SESSION_CREATED",
            "session_id": str(outing.id),
        },
    )

    return SessionCreateResponse(
        id=outing.id,
        name=outing.name,
        join_code=outing.join_code,
        status=outing.status,
        created_at=outing.created_at,
        current_user=CurrentUserSessionState(
            is_active=True,
        ),
    )


@router.post(
    "/join",
    response_model=SessionJoinResponse,
)
def join_session(
    payload: SessionJoinRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> SessionJoinResponse:
    outing, participation = join_outing(
        db,
        user=current_user,
        join_code=payload.join_code,
    )
    record_audit_event(
    db,
    actor_user_id=current_user.id,
    event_type="SESSION_JOINED",
    entity_type="SESSION",
    entity_id=outing.id,
    session_id=outing.id,
    metadata={
        "participation_id": str(participation.id),
    },
)

    active_participant_ids = [
        p.user_id for p in outing.participations if p.left_at is None
    ]

    db.commit()

    broadcast_event(
        active_participant_ids,
        {
            "type": "PARTICIPANT_JOINED",
            "session_id": str(outing.id),
            "user_id": str(current_user.id),
        },
    )

    return SessionJoinResponse(
        session=SessionBasicRead(
            id=outing.id,
            name=outing.name,
            status=outing.status,
        ),
        participation=ParticipationRead(
            id=participation.id,
            joined_at=participation.joined_at,
        ),
    )
    


@router.get(
    "",
    response_model=SessionListResponse,
)
def get_sessions(
    db: DbSession,
    current_user: CurrentUser,
) -> SessionListResponse:
    outings = list_user_outings(
        db,
        user=current_user,
    )

    items = [
        SessionListItem(
            id=outing.id,
            name=outing.name,
            status=outing.status,
            created_at=outing.created_at,
            closed_at=outing.closed_at,
            active_participant_count=count_active_participants(
                db,
                session_id=outing.id,
            ),
            current_user_is_active=is_active_participant(
                db,
                session_id=outing.id,
                user_id=current_user.id,
            ),
        )
        for outing in outings
    ]

    return SessionListResponse(items=items)


@router.get(
    "/{session_id}",
    response_model=SessionDetailResponse,
)
def get_session(
    session_id: UUID,
    db: DbSession,
    current_user: CurrentUser,
) -> SessionDetailResponse:
    outing = get_outing_for_user(
        db,
        session_id=session_id,
        user=current_user,
    )

    current_user_active = is_active_participant(
        db,
        session_id=session_id,
        user_id=current_user.id,
    )

    participant_rows = get_active_participants(
        db,
        session_id=session_id,
    )

    participants = [
        ParticipantRead(
            user_id=user.id,
            display_name=user.display_name,
            username=user.username,
            joined_at=participation.joined_at,
        )
        for participation, user in participant_rows
    ]

    return SessionDetailResponse(
        id=outing.id,
        name=outing.name,
        join_code=(
            outing.join_code
            if outing.status == "ACTIVE"
            else None
        ),
        status=outing.status,
        created_at=outing.created_at,
        closed_at=outing.closed_at,
        active_participants=participants,
        current_user=CurrentUserSessionState(
            is_active=current_user_active,
        ),
    )


@router.post(
    "/{session_id}/leave",
    response_model=SessionLeaveResponse,
)
def leave_session(
    session_id: UUID,
    db: DbSession,
    current_user: CurrentUser,
) -> SessionLeaveResponse:
    participation, outing = leave_outing(
        db,
        session_id=session_id,
        user=current_user,
    )
    record_audit_event(
    db,
    actor_user_id=current_user.id,
    event_type="SESSION_LEFT",
    entity_type="SESSION",
    entity_id=outing.id,
    session_id=outing.id,
    metadata={
        "participation_id": str(participation.id),
        "session_status": outing.status,
        "auto_closed": outing.status == "CLOSED",
    },
)

    notify_user_ids = {p.user_id for p in outing.participations if p.left_at is None} | {current_user.id}

    db.commit()

    broadcast_event(
        notify_user_ids,
        {
            "type": "PARTICIPANT_LEFT",
            "session_id": str(outing.id),
            "user_id": str(current_user.id),
        },
    )

    assert participation.left_at is not None

    return SessionLeaveResponse(
        session_id=outing.id,
        left_at=participation.left_at,
        session_status=outing.status,
    )


@router.post(
    "/{session_id}/finish",
    response_model=SessionFinishResponse,
)
def finish_session(
    session_id: UUID,
    db: DbSession,
    current_user: CurrentUser,
) -> SessionFinishResponse:
    outing = finish_outing(
        db,
        session_id=session_id,
        user=current_user,
    )
    record_audit_event(
    db,
    actor_user_id=current_user.id,
    event_type="SESSION_FINISHED",
    entity_type="SESSION",
    entity_id=outing.id,
    session_id=outing.id,
    metadata={
        "closed_at": (
            outing.closed_at.isoformat()
            if outing.closed_at is not None
            else None
        ),
    },
)

    notify_user_ids = {p.user_id for p in outing.participations}

    db.commit()

    broadcast_event(
        notify_user_ids,
        {
            "type": "SESSION_FINISHED",
            "session_id": str(outing.id),
        },
    )

    assert outing.closed_at is not None

    return SessionFinishResponse(
        session_id=outing.id,
        status=outing.status,
        closed_at=outing.closed_at,
    )