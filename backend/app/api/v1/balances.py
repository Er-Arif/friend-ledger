from uuid import UUID

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.balance import (
    BalanceItem,
    BalancePersonRead,
    BalanceSummaryResponse,
    LedgerEntry,
    PairwiseBalanceResponse,
    PairwiseLedgerResponse,
)
from app.services.balances import (
    calculate_pairwise_net,
    get_balance_counterparts,
    get_counterpart,
    get_pairwise_ledger,
)

router = APIRouter(
    prefix="/me/balances",
    tags=["Balances"],
)


def build_person(user) -> BalancePersonRead:
    return BalancePersonRead(
        user_id=user.id,
        display_name=user.display_name,
        username=user.username,
    )


@router.get(
    "",
    response_model=BalanceSummaryResponse,
)
def get_my_balances(
    db: DbSession,
    current_user: CurrentUser,
) -> BalanceSummaryResponse:
    counterparts = get_balance_counterparts(
        db,
        user_id=current_user.id,
    )

    items: list[BalanceItem] = []

    total_i_owe_minor = 0
    total_owed_to_me_minor = 0

    for person in counterparts:
        net = calculate_pairwise_net(
            db,
            user_id=current_user.id,
            other_user_id=person.id,
        )

        if net == 0:
            continue

        if net > 0:
            direction = "OWED_TO_ME"
            amount_minor = net
            total_owed_to_me_minor += amount_minor
        else:
            direction = "I_OWE"
            amount_minor = abs(net)
            total_i_owe_minor += amount_minor

        items.append(
            BalanceItem(
                person=build_person(person),
                direction=direction,
                amount_minor=amount_minor,
            )
        )

    items.sort(
        key=lambda item: (
            item.person.display_name.casefold(),
            item.person.username.casefold(),
        )
    )

    return BalanceSummaryResponse(
        total_i_owe_minor=total_i_owe_minor,
        total_owed_to_me_minor=total_owed_to_me_minor,
        items=items,
    )


@router.get(
    "/{user_id}",
    response_model=PairwiseBalanceResponse,
)
def get_balance_with_person(
    user_id: UUID,
    db: DbSession,
    current_user: CurrentUser,
) -> PairwiseBalanceResponse:
    person = get_counterpart(
        db,
        current_user_id=current_user.id,
        other_user_id=user_id,
    )

    net = calculate_pairwise_net(
        db,
        user_id=current_user.id,
        other_user_id=user_id,
    )

    if net > 0:
        direction = "OWED_TO_ME"
        amount_minor = net
    elif net < 0:
        direction = "I_OWE"
        amount_minor = abs(net)
    else:
        direction = "SETTLED"
        amount_minor = 0

    return PairwiseBalanceResponse(
        person=build_person(person),
        direction=direction,
        amount_minor=amount_minor,
    )


@router.get(
    "/{user_id}/ledger",
    response_model=PairwiseLedgerResponse,
)
def get_ledger_with_person(
    user_id: UUID,
    db: DbSession,
    current_user: CurrentUser,
) -> PairwiseLedgerResponse:
    person = get_counterpart(
        db,
        current_user_id=current_user.id,
        other_user_id=user_id,
    )

    net = calculate_pairwise_net(
        db,
        user_id=current_user.id,
        other_user_id=user_id,
    )

    if net > 0:
        balance_direction = "OWED_TO_ME"
        balance_amount_minor = net
    elif net < 0:
        balance_direction = "I_OWE"
        balance_amount_minor = abs(net)
    else:
        balance_direction = "SETTLED"
        balance_amount_minor = 0

    rows = get_pairwise_ledger(
        db,
        user_id=current_user.id,
        other_user_id=user_id,
    )

    person_read = build_person(person)

    return PairwiseLedgerResponse(
        person=person_read,
        balance=PairwiseBalanceResponse(
            person=person_read,
            direction=balance_direction,
            amount_minor=balance_amount_minor,
        ),
                entries=[
            LedgerEntry(
                source_type=row.source_type,
                payment_id=(
                    row.payment.id
                    if row.payment is not None
                    else None
                ),
                settlement_id=(
                    row.settlement.id
                    if row.settlement is not None
                    else None
                ),
                session_id=(
                    row.payment.session_id
                    if row.payment is not None
                    else None
                ),
                description=(
                    row.payment.description
                    if row.payment is not None
                    else (
                        row.settlement.note
                        if row.settlement is not None
                        and row.settlement.note
                        else "Settlement"
                    )
                ),
                created_at=(
                    row.payment.created_at
                    if row.payment is not None
                    else row.settlement.created_at
                ),
                direction=row.direction,
                amount_minor=row.amount_minor,
                method=(
                    row.settlement.method
                    if row.settlement is not None
                    else None
                ),
            )
            for row in rows
        ],
    )