from __future__ import annotations

import asyncio
import logging
import secrets
import time
from collections import defaultdict
from collections.abc import Iterable
from typing import Any
from uuid import UUID

from fastapi import WebSocket

logger = logging.getLogger(__name__)

# In-memory ticket storage: ticket -> (user_id, expires_at)
_tickets: dict[str, tuple[UUID, float]] = {}


def _cleanup_expired_tickets() -> None:
    now = time.time()
    expired = [k for k, (_, exp) in _tickets.items() if now > exp]
    for k in expired:
        _tickets.pop(k, None)


def create_realtime_ticket(user_id: UUID, ttl_seconds: int = 60) -> tuple[str, int]:
    """Generates a secure, cryptographically random, short-lived one-time ticket for WebSocket auth."""
    _cleanup_expired_tickets()
    ticket = secrets.token_urlsafe(32)
    _tickets[ticket] = (user_id, time.time() + ttl_seconds)
    return ticket, ttl_seconds


def consume_realtime_ticket(ticket: str) -> UUID | None:
    """Validates and consumes a short-lived ticket. Returns user_id if valid, else None."""
    _cleanup_expired_tickets()
    entry = _tickets.pop(ticket, None)
    if not entry:
        return None
    user_id, expires_at = entry
    if time.time() > expires_at:
        return None
    return user_id


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[UUID, set[WebSocket]] = defaultdict(set)
        self.loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, websocket: WebSocket, user_id: UUID) -> None:
        await websocket.accept()
        self._connections[user_id].add(websocket)
        try:
            self.loop = asyncio.get_running_loop()
        except RuntimeError:
            pass

    def disconnect(self, websocket: WebSocket, user_id: UUID) -> None:
        if user_id in self._connections:
            self._connections[user_id].discard(websocket)
            if not self._connections[user_id]:
                del self._connections[user_id]

    async def _send_to_user(self, user_id: UUID, message: dict[str, Any]) -> None:
        if user_id not in self._connections:
            return
        dead: list[WebSocket] = []
        for ws in list(self._connections[user_id]):
            try:
                await ws.send_json(message)
            except Exception:  # noqa: BLE001
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, user_id)

    async def _broadcast_async(self, user_ids: list[UUID], message: dict[str, Any]) -> None:
        for uid in user_ids:
            await self._send_to_user(uid, message)

    def broadcast(self, user_ids: Iterable[UUID], message: dict[str, Any]) -> None:
        """Safely broadcast invalidation event to target users.

        Non-blocking and failsafe: never raises an exception or interrupts transaction.
        """
        try:
            target_set = set(user_ids)
            active_targets = [uid for uid in target_set if uid in self._connections]
            if not active_targets:
                return

            coro = self._broadcast_async(active_targets, message)

            try:
                running_loop = asyncio.get_running_loop()
                running_loop.create_task(coro)
            except RuntimeError:
                if self.loop and self.loop.is_running():
                    asyncio.run_coroutine_threadsafe(coro, self.loop)
        except Exception as exc:  # noqa: BLE001
            # Broadcast failure must never impact the database transaction
            logger.debug("Broadcast event suppressed error: %s", exc)


manager = ConnectionManager()


def broadcast_event(user_ids: Iterable[UUID], event: dict[str, Any]) -> None:
    """Convenience helper to broadcast a typed invalidation event to target users."""
    manager.broadcast(user_ids, event)
