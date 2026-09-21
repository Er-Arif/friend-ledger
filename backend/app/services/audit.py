from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit_event import AuditEvent


def record_audit_event(
    db: Session,
    *,
    actor_user_id: UUID | None,
    event_type: str,
    entity_type: str,
    entity_id: UUID | None = None,
    session_id: UUID | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditEvent:
    event = AuditEvent(
        actor_user_id=actor_user_id,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        session_id=session_id,
        metadata_json=metadata or {},
    )

    db.add(event)
    db.flush()

    return event