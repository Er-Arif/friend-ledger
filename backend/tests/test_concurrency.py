from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.core.exceptions import AppError
from app.core.security import hash_password
from app.models.audit_event import AuditEvent
from app.models.idempotency_record import IdempotencyRecord
from app.models.payment import Payment
from app.models.session import OutingSession
from app.models.session_participation import SessionParticipation
from app.models.settlement import Settlement
from app.models.user import User
from app.services.audit import record_audit_event
from app.services.balances import calculate_pairwise_net
from app.services.idempotency import (
    begin_idempotent_operation,
    build_request_hash,
    complete_idempotent_operation,
)
from app.services.payments import create_payment
from app.services.sessions import (
    create_outing,
    finish_outing,
    join_outing,
    leave_outing,
)
from app.services.settlements import create_settlement

PASSWORD = "TestPassword123!"


def create_user(
    db: Session,
    *,
    display_name: str,
    username: str,
) -> User:
    user = User(
        display_name=display_name,
        username=username,
        username_normalized=username.casefold(),
        password_hash=hash_password(PASSWORD),
    )

    db.add(user)
    db.flush()
    db.refresh(user)

    return user


def create_test_debt(
    session_factory: sessionmaker[Session],
) -> tuple[UUID, UUID]:
    with session_factory() as db:
        arif = create_user(
            db,
            display_name="Arif",
            username="arif",
        )

        sameer = create_user(
            db,
            display_name="Sameer",
            username="sameer",
        )

        outing, _ = create_outing(
            db,
            user=arif,
            name="Concurrency Test",
        )

        join_outing(
            db,
            user=sameer,
            join_code=outing.join_code,
        )

        create_payment(
            db,
            session_id=outing.id,
            payer=arif,
            description="Dinner",
            total_amount_minor=50000,
            split_type="EQUAL",
            participant_user_ids=[
                sameer.id,
            ],
            custom_shares=None,
        )

        db.commit()

        return sameer.id, arif.id


def attempt_settlement(
    session_factory: sessionmaker[Session],
    barrier: Barrier,
    *,
    from_user_id: UUID,
    to_user_id: UUID,
) -> tuple[str, str | None]:
    with session_factory() as db:
        from_user = db.get(
            User,
            from_user_id,
        )

        assert from_user is not None

        barrier.wait(timeout=10)

        try:
            settlement = create_settlement(
                db,
                from_user=from_user,
                to_user_id=to_user_id,
                amount_minor=40000,
                method="UPI",
                note=None,
            )

            db.commit()

            return (
                "SUCCESS",
                str(settlement.id),
            )

        except AppError as exc:
            db.rollback()

            return (
                exc.code,
                None,
            )


def test_concurrent_settlements_cannot_exceed_debt(
    concurrency_session_factory: sessionmaker[Session],
) -> None:
    sameer_id, arif_id = create_test_debt(
        concurrency_session_factory
    )

    barrier = Barrier(2)

    with ThreadPoolExecutor(
        max_workers=2
    ) as executor:
        first = executor.submit(
            attempt_settlement,
            concurrency_session_factory,
            barrier,
            from_user_id=sameer_id,
            to_user_id=arif_id,
        )

        second = executor.submit(
            attempt_settlement,
            concurrency_session_factory,
            barrier,
            from_user_id=sameer_id,
            to_user_id=arif_id,
        )

        results = [
            first.result(timeout=20),
            second.result(timeout=20),
        ]

    result_codes = sorted(
        result[0]
        for result in results
    )

    assert result_codes == [
        "SETTLEMENT_EXCEEDS_DEBT",
        "SUCCESS",
    ]

    with concurrency_session_factory() as db:
        active_settlements = list(
            db.scalars(
                select(Settlement).where(
                    Settlement.from_user_id
                    == sameer_id,
                    Settlement.to_user_id
                    == arif_id,
                    Settlement.status
                    == "ACTIVE",
                )
            )
        )

        assert len(active_settlements) == 1
        assert (
            active_settlements[0].amount_minor
            == 40000
        )

        remaining_net = calculate_pairwise_net(
            db,
            user_id=sameer_id,
            other_user_id=arif_id,
        )

        assert remaining_net == -10000


def attempt_join_outing(
    session_factory: sessionmaker[Session],
    barrier: Barrier,
    *,
    user_id: UUID,
    join_code: str,
) -> tuple[str, str | None]:
    with session_factory() as db:
        user = db.get(User, user_id)
        assert user is not None

        barrier.wait(timeout=10)

        try:
            _, participation = join_outing(
                db,
                user=user,
                join_code=join_code,
            )
            db.commit()
            return ("SUCCESS", str(participation.id))
        except AppError as exc:
            db.rollback()
            return (exc.code, None)


def test_concurrent_duplicate_joining(
    concurrency_session_factory: sessionmaker[Session],
) -> None:
    with concurrency_session_factory() as db:
        arif = create_user(db, display_name="Arif", username="arif")
        sameer = create_user(db, display_name="Sameer", username="sameer")
        outing, _ = create_outing(db, user=arif, name="Join Race")
        db.commit()
        sameer_id = sameer.id
        join_code = outing.join_code
        outing_id = outing.id

    barrier = Barrier(2)

    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(
            attempt_join_outing,
            concurrency_session_factory,
            barrier,
            user_id=sameer_id,
            join_code=join_code,
        )
        second = executor.submit(
            attempt_join_outing,
            concurrency_session_factory,
            barrier,
            user_id=sameer_id,
            join_code=join_code,
        )

        results = [
            first.result(timeout=20),
            second.result(timeout=20),
        ]

    result_codes = sorted(result[0] for result in results)
    assert result_codes == [
        "ALREADY_ACTIVE_PARTICIPANT",
        "SUCCESS",
    ]

    with concurrency_session_factory() as db:
        participations = list(
            db.scalars(
                select(SessionParticipation).where(
                    SessionParticipation.session_id == outing_id,
                    SessionParticipation.user_id == sameer_id,
                )
            )
        )
        active_participations = [
            p for p in participations if p.left_at is None
        ]
        assert len(active_participations) == 1


def attempt_leave_outing(
    session_factory: sessionmaker[Session],
    barrier: Barrier,
    *,
    user_id: UUID,
    session_id: UUID,
) -> tuple[str, str | None]:
    with session_factory() as db:
        user = db.get(User, user_id)
        assert user is not None

        barrier.wait(timeout=10)

        try:
            participation, _ = leave_outing(
                db,
                session_id=session_id,
                user=user,
            )
            db.commit()
            return ("SUCCESS", str(participation.id))
        except AppError as exc:
            db.rollback()
            return (exc.code, None)


def attempt_finish_outing(
    session_factory: sessionmaker[Session],
    barrier: Barrier,
    *,
    user_id: UUID,
    session_id: UUID,
) -> tuple[str, str | None]:
    with session_factory() as db:
        user = db.get(User, user_id)
        assert user is not None

        barrier.wait(timeout=10)

        try:
            outing = finish_outing(
                db,
                session_id=session_id,
                user=user,
            )
            db.commit()
            return ("SUCCESS", str(outing.id))
        except AppError as exc:
            db.rollback()
            return (exc.code, None)


def test_concurrent_leave_vs_finish_race(
    concurrency_session_factory: sessionmaker[Session],
) -> None:
    with concurrency_session_factory() as db:
        arif = create_user(db, display_name="Arif", username="arif")
        sameer = create_user(db, display_name="Sameer", username="sameer")
        outing, _ = create_outing(db, user=arif, name="Lifecycle Race")
        join_outing(db, user=sameer, join_code=outing.join_code)
        db.commit()
        arif_id = arif.id
        sameer_id = sameer.id
        outing_id = outing.id

    barrier = Barrier(2)

    with ThreadPoolExecutor(max_workers=2) as executor:
        leave_task = executor.submit(
            attempt_leave_outing,
            concurrency_session_factory,
            barrier,
            user_id=sameer_id,
            session_id=outing_id,
        )
        finish_task = executor.submit(
            attempt_finish_outing,
            concurrency_session_factory,
            barrier,
            user_id=arif_id,
            session_id=outing_id,
        )

        leave_result = leave_task.result(timeout=20)
        finish_result = finish_task.result(timeout=20)

    # Both operations must complete gracefully with structured domain results
    assert leave_result[0] in ("SUCCESS", "SESSION_CLOSED")
    assert finish_result[0] in ("SUCCESS", "SESSION_FINISH_NOT_ALLOWED")

    with concurrency_session_factory() as db:
        outing = db.get(OutingSession, outing_id)
        assert outing is not None

        participations = list(
            db.scalars(
                select(SessionParticipation).where(
                    SessionParticipation.session_id == outing_id
                )
            )
        )
        active_count = len([p for p in participations if p.left_at is None])

        # Validate session state invariants:
        # If CLOSED, closed_at must exist and active_count must be 0
        # If ACTIVE, closed_at must be None and active_count must be 1
        if outing.status == "CLOSED":
            assert outing.closed_at is not None
            assert active_count == 0
        elif outing.status == "ACTIVE":
            assert outing.closed_at is None
            assert active_count == 1
        else:
            pytest.fail(f"Invalid outing status: {outing.status}")

        # Validate participation timestamp consistency
        for p in participations:
            if p.left_at is not None:
                assert p.left_at >= p.joined_at


def attempt_idempotent_payment(
    session_factory: sessionmaker[Session],
    barrier: Barrier,
    *,
    user_id: UUID,
    session_id: UUID,
    idempotency_key: str,
    payload: dict,
) -> tuple[str, str | None]:
    with session_factory() as db:
        user = db.get(User, user_id)
        assert user is not None

        request_hash = build_request_hash(
            {
                "session_id": str(session_id),
                "payload": payload,
            }
        )

        barrier.wait(timeout=10)

        try:
            record = begin_idempotent_operation(
                db,
                user_id=user.id,
                operation="CREATE_PAYMENT",
                idempotency_key=idempotency_key,
                request_hash=request_hash,
            )

            if record.state == "COMPLETED":
                assert record.response_body is not None
                db.commit()
                return ("SUCCESS", record.response_body["id"])

            payment = create_payment(
                db,
                session_id=session_id,
                payer=user,
                description=payload["description"],
                total_amount_minor=payload["total_amount_minor"],
                split_type=payload["split_type"],
                participant_user_ids=[
                    UUID(uid)
                    for uid in payload["participant_user_ids"]
                ],
                custom_shares=None,
            )

            record_audit_event(
                db,
                actor_user_id=user.id,
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
                response_body={"id": str(payment.id)},
            )

            db.commit()
            return ("SUCCESS", str(payment.id))

        except AppError as exc:
            db.rollback()
            return (exc.code, None)


def test_concurrent_identical_idempotency_requests(
    concurrency_session_factory: sessionmaker[Session],
) -> None:
    with concurrency_session_factory() as db:
        arif = create_user(db, display_name="Arif", username="arif")
        sameer = create_user(db, display_name="Sameer", username="sameer")
        outing, _ = create_outing(db, user=arif, name="Idempotency Race")
        join_outing(db, user=sameer, join_code=outing.join_code)
        db.commit()
        arif_id = arif.id
        sameer_id = sameer.id
        outing_id = outing.id

    idempotency_key = str(uuid4())
    payload = {
        "description": "Taxi ride",
        "total_amount_minor": 15000,
        "split_type": "EQUAL",
        "participant_user_ids": [str(arif_id), str(sameer_id)],
    }

    barrier = Barrier(2)

    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(
            attempt_idempotent_payment,
            concurrency_session_factory,
            barrier,
            user_id=arif_id,
            session_id=outing_id,
            idempotency_key=idempotency_key,
            payload=payload,
        )
        second = executor.submit(
            attempt_idempotent_payment,
            concurrency_session_factory,
            barrier,
            user_id=arif_id,
            session_id=outing_id,
            idempotency_key=idempotency_key,
            payload=payload,
        )

        first_res = first.result(timeout=20)
        second_res = second.result(timeout=20)

    # Both must succeed and return the exact same payment id
    assert first_res[0] == "SUCCESS"
    assert second_res[0] == "SUCCESS"
    assert first_res[1] == second_res[1]
    payment_id = UUID(first_res[1])

    with concurrency_session_factory() as db:
        # Exactly one payment in DB
        payments = list(
            db.scalars(
                select(Payment).where(Payment.session_id == outing_id)
            )
        )
        assert len(payments) == 1
        assert payments[0].id == payment_id

        # Exactly one audit record for PAYMENT_CREATED
        audits = list(
            db.scalars(
                select(AuditEvent).where(
                    AuditEvent.event_type == "PAYMENT_CREATED",
                    AuditEvent.entity_id == payment_id,
                )
            )
        )
        assert len(audits) == 1

        # Exactly one idempotency record
        records = list(
            db.scalars(
                select(IdempotencyRecord).where(
                    IdempotencyRecord.user_id == arif_id,
                    IdempotencyRecord.idempotency_key == idempotency_key,
                )
            )
        )
        assert len(records) == 1
        assert records[0].state == "COMPLETED"


def test_concurrent_reuse_of_same_idempotency_key_with_different_request(
    concurrency_session_factory: sessionmaker[Session],
) -> None:
    with concurrency_session_factory() as db:
        arif = create_user(db, display_name="Arif", username="arif")
        sameer = create_user(db, display_name="Sameer", username="sameer")
        outing, _ = create_outing(
            db, user=arif, name="Idempotency Conflict Race"
        )
        join_outing(db, user=sameer, join_code=outing.join_code)
        db.commit()
        arif_id = arif.id
        sameer_id = sameer.id
        outing_id = outing.id

    idempotency_key = str(uuid4())

    payload_a = {
        "description": "Lunch",
        "total_amount_minor": 20000,
        "split_type": "EQUAL",
        "participant_user_ids": [str(arif_id), str(sameer_id)],
    }
    payload_b = {
        "description": "Lunch with drinks",
        "total_amount_minor": 35000,
        "split_type": "EQUAL",
        "participant_user_ids": [str(arif_id), str(sameer_id)],
    }

    barrier = Barrier(2)

    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(
            attempt_idempotent_payment,
            concurrency_session_factory,
            barrier,
            user_id=arif_id,
            session_id=outing_id,
            idempotency_key=idempotency_key,
            payload=payload_a,
        )
        second = executor.submit(
            attempt_idempotent_payment,
            concurrency_session_factory,
            barrier,
            user_id=arif_id,
            session_id=outing_id,
            idempotency_key=idempotency_key,
            payload=payload_b,
        )

        results = [
            first.result(timeout=20),
            second.result(timeout=20),
        ]

    result_codes = sorted(res[0] for res in results)
    assert result_codes == [
        "IDEMPOTENCY_KEY_REUSED",
        "SUCCESS",
    ]

    with concurrency_session_factory() as db:
        # Exactly ONE payment created
        payments = list(
            db.scalars(
                select(Payment).where(Payment.session_id == outing_id)
            )
        )
        assert len(payments) == 1

        # Exactly ONE audit event created
        audits = list(
            db.scalars(
                select(AuditEvent).where(
                    AuditEvent.event_type == "PAYMENT_CREATED",
                    AuditEvent.session_id == outing_id,
                )
            )
        )
        assert len(audits) == 1

        # Exactly ONE idempotency record in DB
        records = list(
            db.scalars(
                select(IdempotencyRecord).where(
                    IdempotencyRecord.user_id == arif_id,
                    IdempotencyRecord.idempotency_key == idempotency_key,
                )
            )
        )
        assert len(records) == 1
        assert records[0].state == "COMPLETED"