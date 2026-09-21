from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, status

from app.api.deps import CurrentUser, DbSession
from app.models.settlement import Settlement
from app.models.user import User
from app.schemas.settlement import (
    SettlementCreateRequest,
    SettlementRead,
    SettlementUserRead,
    SettlementVoidRequest,
)
from app.services.audit import record_audit_event
from app.services.idempotency import (
    begin_idempotent_operation,
    build_request_hash,
    complete_idempotent_operation,
)
from app.services.settlements import (
    create_settlement,
    get_settlement_for_user,
    void_settlement,
)

router = APIRouter(
    prefix="/settlements",
    tags=["Settlements"],
)


def build_user(user: User) -> SettlementUserRead:
    return SettlementUserRead(
        user_id=user.id,
        display_name=user.display_name,
        username=user.username,
    )


def build_settlement_response(
    db: DbSession,
    settlement: Settlement,
) -> SettlementRead:
    from_user = db.get(
        User,
        settlement.from_user_id,
    )

    to_user = db.get(
        User,
        settlement.to_user_id,
    )

    assert from_user is not None
    assert to_user is not None

    return SettlementRead(
        id=settlement.id,
        from_user=build_user(from_user),
        to_user=build_user(to_user),
        amount_minor=settlement.amount_minor,
        method=settlement.method,
        note=settlement.note,
        status=settlement.status,
        created_at=settlement.created_at,
        voided_at=settlement.voided_at,
        void_reason=settlement.void_reason,
    )


@router.post(
    "",
    response_model=SettlementRead,
    status_code=status.HTTP_201_CREATED,
)
def record_settlement(
    payload: SettlementCreateRequest,
    db: DbSession,
    current_user: CurrentUser,
    idempotency_key: Annotated[
        str,
        Header(
            alias="Idempotency-Key",
            min_length=1,
            max_length=128,
        ),
    ],
) -> SettlementRead:
    request_hash = build_request_hash(
        {
            "payload": payload.model_dump(
                mode="json",
            ),
        }
    )

    record = begin_idempotent_operation(
        db,
        user_id=current_user.id,
        operation="CREATE_SETTLEMENT",
        idempotency_key=idempotency_key,
        request_hash=request_hash,
    )

    if record.state == "COMPLETED":
        assert record.response_body is not None

        return SettlementRead.model_validate(
            record.response_body
        )

    settlement = create_settlement(
        db,
        from_user=current_user,
        to_user_id=payload.to_user_id,
        amount_minor=payload.amount_minor,
        method=payload.method,
        note=payload.note,
    )

    response = build_settlement_response(
        db,
        settlement,
    )
    record_audit_event(
    db,
    actor_user_id=current_user.id,
    event_type="SETTLEMENT_CREATED",
    entity_type="SETTLEMENT",
    entity_id=settlement.id,
    metadata={
        "to_user_id": str(settlement.to_user_id),
        "amount_minor": settlement.amount_minor,
        "method": settlement.method,
    },
)

    complete_idempotent_operation(
        record,
        response_status=201,
        response_body=response.model_dump(
            mode="json",
        ),
    )

    db.commit()

    return response


@router.get(
    "/{settlement_id}",
    response_model=SettlementRead,
)
def get_settlement(
    settlement_id: UUID,
    db: DbSession,
    current_user: CurrentUser,
) -> SettlementRead:
    settlement = get_settlement_for_user(
        db,
        settlement_id=settlement_id,
        user=current_user,
    )

    return build_settlement_response(
        db,
        settlement,
    )


@router.post(
    "/{settlement_id}/void",
    response_model=SettlementRead,
)
def void_existing_settlement(
    settlement_id: UUID,
    payload: SettlementVoidRequest,
    db: DbSession,
    current_user: CurrentUser,
    idempotency_key: Annotated[
        str,
        Header(
            alias="Idempotency-Key",
            min_length=1,
            max_length=128,
        ),
    ],
) -> SettlementRead:
    request_hash = build_request_hash(
        {
            "settlement_id": str(settlement_id),
            "payload": payload.model_dump(
                mode="json",
            ),
        }
    )

    record = begin_idempotent_operation(
        db,
        user_id=current_user.id,
        operation="VOID_SETTLEMENT",
        idempotency_key=idempotency_key,
        request_hash=request_hash,
    )

    if record.state == "COMPLETED":
        assert record.response_body is not None

        return SettlementRead.model_validate(
            record.response_body
        )

    settlement = void_settlement(
        db,
        settlement_id=settlement_id,
        user=current_user,
        reason=payload.reason,
    )

    response = build_settlement_response(
        db,
        settlement,
    )
    record_audit_event(
    db,
    actor_user_id=current_user.id,
    event_type="SETTLEMENT_VOIDED",
    entity_type="SETTLEMENT",
    entity_id=settlement.id,
    metadata={
        "reason": settlement.void_reason,
    },
)

    complete_idempotent_operation(
        record,
        response_status=200,
        response_body=response.model_dump(
            mode="json",
        ),
    )

    db.commit()

    return response