from datetime import datetime, timedelta, timezone

import pytest

from app.rate_limit import RateLimitExceeded, enforce_chat_rate_limit


class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def in_(self, *_a, **_k):
        return self

    def gte(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def execute(self):
        class _Result:
            def __init__(self, data):
                self.data = data

        return _Result(self._rows)


class _FakeClient:
    def __init__(self, conversation_rows, message_rows):
        self._conversation_rows = conversation_rows
        self._message_rows = message_rows

    def table(self, name):
        if name == "conversations":
            return _FakeQuery(self._conversation_rows)
        if name == "messages":
            return _FakeQuery(self._message_rows)
        raise AssertionError(f"unexpected table {name!r}")


def test_no_conversations_yet_never_blocks():
    client = _FakeClient(conversation_rows=[], message_rows=[])
    enforce_chat_rate_limit("tenant-1", client=client)  # should not raise


def test_allows_normal_traffic_under_the_caps():
    old_message = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    client = _FakeClient(
        conversation_rows=[{"id": "conv-1"}],
        message_rows=[{"created_at": old_message}],
    )
    enforce_chat_rate_limit("tenant-1", client=client)  # should not raise


def test_blocks_when_messages_arrive_too_quickly():
    just_now = datetime.now(timezone.utc).isoformat()
    client = _FakeClient(
        conversation_rows=[{"id": "conv-1"}],
        message_rows=[{"created_at": just_now}],
    )
    with pytest.raises(RateLimitExceeded):
        enforce_chat_rate_limit("tenant-1", client=client)


def test_blocks_when_daily_cap_reached():
    old_message = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    client = _FakeClient(
        conversation_rows=[{"id": "conv-1"}],
        message_rows=[{"created_at": old_message}] * 200,
    )
    with pytest.raises(RateLimitExceeded):
        enforce_chat_rate_limit("tenant-1", client=client)
