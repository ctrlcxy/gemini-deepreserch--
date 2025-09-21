from __future__ import annotations

import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Callable, List, Optional, TypeVar

from dotenv import load_dotenv


T = TypeVar("T")


@dataclass
class GeminiKeyRecord:
    """Internal representation for a Gemini API key."""

    raw_key: str
    masked_key: str
    status: str = "idle"
    disabled: bool = False
    last_error: Optional[str] = None
    last_used_at: Optional[float] = None
    last_success_at: Optional[float] = None
    last_failure_at: Optional[float] = None
    success_count: int = 0
    failure_count: int = 0
    last_used: bool = False


class GeminiKeyExhaustedError(RuntimeError):
    """Raised when all Gemini API keys have failed."""

    def __init__(self, message: str, errors: Optional[List[BaseException]] = None):
        super().__init__(message)
        self.errors = errors or []


class GeminiKeyManager:
    """Round-robin manager for multiple Gemini API keys with failover tracking."""

    def __init__(self, keys: List[str]):
        if not keys:
            raise ValueError(
                "GeminiKeyManager requires at least one API key. "
                "Set GEMINI_API_KEYS or GEMINI_API_KEY."
            )

        self._lock = Lock()
        self._records: List[GeminiKeyRecord] = [
            GeminiKeyRecord(raw_key=key, masked_key=self._mask_key(key)) for key in keys
        ]
        self._next_index = 0
        self._last_used_index: Optional[int] = None

    @classmethod
    def from_environment(cls) -> "GeminiKeyManager":
        """Instantiate the manager using environment variables."""
        load_dotenv()

        raw_keys = os.getenv("GEMINI_API_KEYS")
        keys: List[str] = []
        if raw_keys:
            for chunk in raw_keys.splitlines():
                parts = [part.strip() for part in chunk.split(",") if part.strip()]
                keys.extend(parts)
        else:
            single_key = os.getenv("GEMINI_API_KEY")
            if single_key:
                keys = [single_key.strip()]

        # Remove duplicates while preserving order
        unique_keys: List[str] = []
        seen: set[str] = set()
        for key in keys:
            if key and key not in seen:
                seen.add(key)
                unique_keys.append(key)

        if not unique_keys:
            raise ValueError(
                "No Gemini API keys found. Provide GEMINI_API_KEYS or GEMINI_API_KEY."
            )

        return cls(unique_keys)

    def run_with_key(self, fn: Callable[[str], T]) -> T:
        """Execute a callable with automatic key rotation on failure."""
        errors: List[BaseException] = []

        for _ in range(len(self._records)):
            index = self._activate_next_index()
            if index is None:
                break

            key_record = self._records[index]
            key = key_record.raw_key

            try:
                result = fn(key)
            except Exception as exc:  # noqa: BLE001 - we intentionally capture all errors
                errors.append(exc)
                self._record_failure(index, exc)
                continue

            self._record_success(index)
            return result

        raise GeminiKeyExhaustedError(
            "All Gemini API keys failed. Review key statuses for details.", errors
        )

    def _activate_next_index(self) -> Optional[int]:
        with self._lock:
            total = len(self._records)
            for offset in range(total):
                index = (self._next_index + offset) % total
                record = self._records[index]
                if record.disabled:
                    continue
                record.status = "active"
                record.last_used_at = time.time()
                self._next_index = (index + 1) % total
                return index
            return None

    def _record_success(self, index: int) -> None:
        now = time.time()
        with self._lock:
            if self._last_used_index is not None and self._last_used_index != index:
                self._records[self._last_used_index].last_used = False

            record = self._records[index]
            record.status = "healthy"
            record.last_error = None
            record.last_success_at = now
            record.success_count += 1
            record.last_used = True
            record.last_used_at = now
            self._last_used_index = index

    def _record_failure(self, index: int, error: BaseException) -> None:
        now = time.time()
        with self._lock:
            record = self._records[index]
            record.status = "failed"
            record.last_error = str(error)
            record.last_failure_at = now
            record.failure_count += 1
            record.disabled = True
            record.last_used = False
            if self._last_used_index == index:
                self._last_used_index = None

    def get_statuses(self) -> List[dict[str, Any]]:
        """Return the public status for each key."""
        with self._lock:
            statuses: List[dict[str, Any]] = []
            for idx, record in enumerate(self._records):
                statuses.append(
                    {
                        "index": idx,
                        "maskedKey": record.masked_key,
                        "status": record.status,
                        "disabled": record.disabled,
                        "lastError": record.last_error,
                        "lastUsedAt": self._format_ts(record.last_used_at),
                        "lastSuccessAt": self._format_ts(record.last_success_at),
                        "lastFailureAt": self._format_ts(record.last_failure_at),
                        "successCount": record.success_count,
                        "failureCount": record.failure_count,
                        "isLastUsed": record.last_used,
                    }
                )
            return statuses

    def available_key_count(self) -> int:
        with self._lock:
            return sum(1 for record in self._records if not record.disabled)

    @staticmethod
    def _mask_key(key: str) -> str:
        if len(key) <= 10:
            return f"{key[:2]}***{key[-2:]}"
        return f"{key[:6]}...{key[-4:]}"

    @staticmethod
    def _format_ts(ts: Optional[float]) -> Optional[str]:
        if ts is None:
            return None
        return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


_manager: Optional[GeminiKeyManager] = None
_manager_lock = Lock()


def initialize_key_manager(keys: Optional[List[str]] = None) -> GeminiKeyManager:
    """Initialise the global GeminiKeyManager singleton."""
    global _manager
    with _manager_lock:
        if _manager is None:
            if keys is not None:
                _manager = GeminiKeyManager(keys)
            else:
                _manager = GeminiKeyManager.from_environment()
        return _manager


def get_key_manager() -> GeminiKeyManager:
    """Return the global GeminiKeyManager, initialising it if necessary."""
    if _manager is None:
        return initialize_key_manager()
    return _manager
