import hashlib
import json
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.models.idempotency_record import IdempotencyRecord

IDEMPOTENCY_TTL_HOURS = 24


def build_request_hash(
    payload: dict[str, Any],
) -> str:
    canonical = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=str,
    )

    return hashlib.sha256(
        canonical.encode("utf-8")
    ).hexdigest()


def begin_idempotent_operation(
    db: Session,
    *,
    user_id: UUID,
    operation: str,
    idempotency_key: str,
    request_hash: str,
) -> IdempotencyRecord:
    existing = db.scalar(
        select(IdempotencyRecord)
        .where(
            IdempotencyRecord.user_id == user_id,
            IdempotencyRecord.operation == operation,
            IdempotencyRecord.idempotency_key
            == idempotency_key,
        )
        .with_for_update()
    )

    if existing is not None:
        if existing.request_hash != request_hash:
            raise AppError(
                code="IDEMPOTENCY_KEY_REUSED",
                message=(
                    "This idempotency key was already used "
                    "with a different request."
                ),
                status_code=409,
            )

        if existing.state == "COMPLETED":
            return existing

        raise AppError(
            code="IDEMPOTENCY_REQUEST_IN_PROGRESS",
            message=(
                "A request with this idempotency key "
                "is already being processed."
            ),
            status_code=409,
        )

    now = datetime.now(UTC)

    record = IdempotencyRecord(
        user_id=user_id,
        operation=operation,
        idempotency_key=idempotency_key,
        request_hash=request_hash,
        state="IN_PROGRESS",
        expires_at=(
            now + timedelta(hours=IDEMPOTENCY_TTL_HOURS)
        ),
    )

    db.add(record)

    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()

        raise AppError(
            code="IDEMPOTENCY_CONFLICT",
            message=(
                "Another request with this idempotency key "
                "is already being processed."
            ),
            status_code=409,
        ) from exc

    return record


def complete_idempotent_operation(
    record: IdempotencyRecord,
    *,
    response_status: int,
    response_body: dict[str, Any],
) -> None:
    record.state = "COMPLETED"
    record.response_status = response_status
    record.response_body = response_body
    record.completed_at = datetime.now(UTC)