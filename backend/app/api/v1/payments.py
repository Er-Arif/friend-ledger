from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.models.payment import Payment
from app.models.payment_share import PaymentShare
from app.models.user import User
from app.schemas.payment import (
    PaymentCreateRequest,
    PaymentListResponse,
    PaymentRead,
    PaymentShareRead,
    PaymentUserRead,
    PaymentVoidRequest,
)
from app.services.audit import record_audit_event
from app.services.idempotency import (
    begin_idempotent_operation,
    build_request_hash,
    complete_idempotent_operation,
)
from app.services.payments import (
    create_payment,
    get_payment_for_user,
    list_session_payments,
    void_payment,
)

router = APIRouter(
    tags=["Payments"],
)


def build_payment_response(
    db: DbSession,
    payment: Payment,
) -> PaymentRead:
    payer = db.get(
        User,
        payment.payer_user_id,
    )

    assert payer is not None

    share_rows = db.execute(
        select(PaymentShare, User)
        .join(
            User,
            User.id == PaymentShare.user_id,
        )
        .where(
            PaymentShare.payment_id == payment.id,
        )
        .order_by(
            PaymentShare.created_at.asc(),
            PaymentShare.user_id.asc(),
        )
    ).all()

    return PaymentRead(
        id=payment.id,
        session_id=payment.session_id,
        payer=PaymentUserRead(
            user_id=payer.id,
            display_name=payer.display_name,
            username=payer.username,
        ),
        description=payment.description,
        total_amount_minor=payment.total_amount_minor,
        split_type=payment.split_type,
        status=payment.status,
        corrected_from_payment_id=(
            payment.corrected_from_payment_id
        ),
        created_at=payment.created_at,
        voided_at=payment.voided_at,
        void_reason=payment.void_reason,
        shares=[
            PaymentShareRead(
                user_id=user.id,
                display_name=user.display_name,
                username=user.username,
                amount_minor=share.amount_minor,
            )
            for share, user in share_rows
        ],
    )


@router.post(
    "/sessions/{session_id}/payments",
    response_model=PaymentRead,
    status_code=status.HTTP_201_CREATED,
)
def add_payment(
    session_id: UUID,
    payload: PaymentCreateRequest,
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
) -> PaymentRead:
    request_hash = build_request_hash(
        {
            "session_id": str(session_id),
            "payload": payload.model_dump(
                mode="json",
            ),
        }
    )

    record = begin_idempotent_operation(
        db,
        user_id=current_user.id,
        operation="CREATE_PAYMENT",
        idempotency_key=idempotency_key,
        request_hash=request_hash,
    )

    if record.state == "COMPLETED":
        assert record.response_body is not None

        return PaymentRead.model_validate(
            record.response_body
        )

    custom_shares = (
        {
            share.user_id: share.amount_minor
            for share in payload.custom_shares
        }
        if payload.custom_shares
        else None
    )

    payment = create_payment(
        db,
        session_id=session_id,
        payer=current_user,
        description=payload.description,
        total_amount_minor=payload.total_amount_minor,
        split_type=payload.split_type,
        participant_user_ids=(
            payload.participant_user_ids
        ),
        custom_shares=custom_shares,
    )

    response = build_payment_response(
        db,
        payment,
    )
    record_audit_event(
    db,
    actor_user_id=current_user.id,
    event_type="PAYMENT_CREATED",
    entity_type="PAYMENT",
    entity_id=payment.id,
    session_id=payment.session_id,
    metadata={
        "total_amount_minor": payment.total_amount_minor,
        "split_type": payment.split_type,
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
    "/sessions/{session_id}/payments",
    response_model=PaymentListResponse,
)
def get_session_payments(
    session_id: UUID,
    db: DbSession,
    current_user: CurrentUser,
) -> PaymentListResponse:
    payments = list_session_payments(
        db,
        session_id=session_id,
        user=current_user,
    )

    return PaymentListResponse(
        items=[
            build_payment_response(
                db,
                payment,
            )
            for payment in payments
        ]
    )


@router.get(
    "/payments/{payment_id}",
    response_model=PaymentRead,
)
def get_payment(
    payment_id: UUID,
    db: DbSession,
    current_user: CurrentUser,
) -> PaymentRead:
    payment = get_payment_for_user(
        db,
        payment_id=payment_id,
        user=current_user,
    )

    return build_payment_response(
        db,
        payment,
    )


@router.post(
    "/payments/{payment_id}/void",
    response_model=PaymentRead,
)
def void_existing_payment(
    payment_id: UUID,
    payload: PaymentVoidRequest,
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
) -> PaymentRead:
    request_hash = build_request_hash(
        {
            "payment_id": str(payment_id),
            "payload": payload.model_dump(
                mode="json",
            ),
        }
    )

    record = begin_idempotent_operation(
        db,
        user_id=current_user.id,
        operation="VOID_PAYMENT",
        idempotency_key=idempotency_key,
        request_hash=request_hash,
    )

    if record.state == "COMPLETED":
        assert record.response_body is not None

        return PaymentRead.model_validate(
            record.response_body
        )

    payment = void_payment(
        db,
        payment_id=payment_id,
        user=current_user,
        reason=payload.reason,
    )

    response = build_payment_response(
        db,
        payment,
    )
    record_audit_event(
    db,
    actor_user_id=current_user.id,
    event_type="PAYMENT_VOIDED",
    entity_type="PAYMENT",
    entity_id=payment.id,
    session_id=payment.session_id,
    metadata={
        "reason": payment.void_reason,
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