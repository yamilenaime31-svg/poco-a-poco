"""Per-request clock. Demo accounts carry a fixed "now" so their prepared scenario stays coherent; everyone else gets real time."""
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Optional

DEMO_NOW: ContextVar[Optional[datetime]] = ContextVar("demo_now", default=None)


def now() -> datetime:
    return DEMO_NOW.get() or datetime.now(timezone.utc)


def use_clock(user: dict) -> None:
    DEMO_NOW.set(datetime.fromisoformat(user["demo_now"]) if user.get("demo_now") else None)
