import pytest

from agent.key_manager import GeminiKeyExhaustedError, GeminiKeyManager


def test_round_robin_rotation_success():
    manager = GeminiKeyManager(["alpha", "beta"])
    seen = []

    def recorder(key: str) -> str:
        seen.append(key)
        return key

    first = manager.run_with_key(recorder)
    second = manager.run_with_key(recorder)

    assert first == "alpha"
    assert second == "beta"
    assert seen == ["alpha", "beta"]

    statuses = manager.get_statuses()
    assert statuses[0]["status"] == "healthy"
    assert statuses[0]["successCount"] == 1
    assert statuses[1]["status"] == "healthy"
    assert statuses[1]["successCount"] == 1
    assert statuses[1]["isLastUsed"] is True


def test_failure_disables_key_and_fails_over():
    manager = GeminiKeyManager(["good", "bad"])

    def always_success(key: str) -> str:
        return key

    manager.run_with_key(always_success)

    attempts = []

    def fail_for_bad(key: str) -> str:
        attempts.append(key)
        if key == "bad":
            raise RuntimeError("bad key disabled")
        return key

    result = manager.run_with_key(fail_for_bad)

    assert result == "good"
    assert attempts == ["bad", "good"]

    statuses = manager.get_statuses()
    assert statuses[1]["status"] == "failed"
    assert statuses[1]["disabled"] is True
    assert statuses[1]["failureCount"] == 1
    assert statuses[0]["successCount"] == 2
    assert manager.available_key_count() == 1


def test_raises_when_all_keys_fail():
    manager = GeminiKeyManager(["broken"])

    def always_fail(_: str) -> str:
        raise RuntimeError("no keys work")

    with pytest.raises(GeminiKeyExhaustedError):
        manager.run_with_key(always_fail)

    statuses = manager.get_statuses()
    assert statuses[0]["disabled"] is True
    assert statuses[0]["status"] == "failed"
    assert manager.available_key_count() == 0
