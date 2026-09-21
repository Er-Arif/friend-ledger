from uuid import UUID

from fastapi import APIRouter, status
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
    payer = db.get(User, payment.payer_user_id)

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
        corrected_from_payment_id=payment.corrected_from_payment_id,
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
) -> PaymentRead:
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
        participant_user_ids=payload.participant_user_ids,
        custom_shares=custom_shares,
    )

    return build_payment_response(
        db,
        payment,
    )


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
            build_payment_response(db, payment)
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
) -> PaymentRead:
    payment = void_payment(
        db,
        payment_id=payment_id,
        user=current_user,
        reason=payload.reason,
    )

    return build_payment_response(
        db,
        payment,
    )