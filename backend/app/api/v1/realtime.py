import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.api.deps import CurrentUser
from app.schemas.realtime import RealtimeTicketResponse
from app.services.realtime import (
    consume_realtime_ticket,
    create_realtime_ticket,
    manager,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/realtime",
    tags=["Realtime"],
)


@router.post(
    "/ticket",
    response_model=RealtimeTicketResponse,
)
def get_realtime_ticket(
    current_user: CurrentUser,
) -> RealtimeTicketResponse:
    ticket, expires_in = create_realtime_ticket(current_user.id)
    return RealtimeTicketResponse(
        ticket=ticket,
        expires_in=expires_in,
    )


@router.websocket("/ws")
async def websocket_realtime_endpoint(
    websocket: WebSocket,
    ticket: str | None = Query(default=None),
) -> None:
    if not ticket:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Ticket required")
        return

    user_id = consume_realtime_ticket(ticket)
    if not user_id:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Invalid or expired ticket",
        )
        return

    await manager.connect(websocket, user_id)
    try:
        while True:
            # Listen for client heartbeat/ping messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception as exc:  # noqa: BLE001
        logger.debug("WebSocket connection terminated: %s", exc)
        manager.disconnect(websocket, user_id)
