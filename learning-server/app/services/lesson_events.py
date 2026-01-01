import asyncio
from typing import Any

from starlette.websockets import WebSocket


class LessonEventHub:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None

    def publish(self, email: str, payload: dict[str, Any], delay_seconds: float = 0.0) -> None:
        if self._loop:
            asyncio.run_coroutine_threadsafe(
                self._broadcast_with_delay(email, payload, delay_seconds),
                self._loop,
            )
            return
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        loop.create_task(self._broadcast_with_delay(email, payload, delay_seconds))

    async def _broadcast_with_delay(
        self, email: str, payload: dict[str, Any], delay_seconds: float
    ) -> None:
        if delay_seconds > 0:
            await asyncio.sleep(delay_seconds)
        await self.broadcast(email, payload)

    async def connect(self, email: str, websocket: WebSocket) -> None:
        if self._loop is None:
            self._loop = asyncio.get_running_loop()
        async with self._lock:
            self._connections.setdefault(email, set()).add(websocket)

    async def disconnect(self, email: str, websocket: WebSocket) -> None:
        async with self._lock:
            sockets = self._connections.get(email)
            if not sockets:
                return
            sockets.discard(websocket)
            if not sockets:
                self._connections.pop(email, None)

    async def broadcast(self, email: str, payload: dict[str, Any]) -> None:
        async with self._lock:
            sockets = list(self._connections.get(email, set()))
        if not sockets:
            return
        stale: list[WebSocket] = []
        for websocket in sockets:
            try:
                await websocket.send_json(payload)
            except RuntimeError:
                stale.append(websocket)
        if stale:
            async with self._lock:
                for websocket in stale:
                    for sockets_set in self._connections.values():
                        sockets_set.discard(websocket)
