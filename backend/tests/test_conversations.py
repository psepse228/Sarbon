from types import SimpleNamespace

from app import conversations


class _FakeQuery:
    def __init__(self, data):
        self._data = data
        self.eq_calls = []
        self.inserted = None

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, column, value):
        self.eq_calls.append((column, value))
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def insert(self, payload):
        self.inserted = payload
        self._data = [{**payload, "id": "new-id"}]
        return self

    def execute(self):
        return SimpleNamespace(data=self._data)


class _FakeClient:
    def __init__(self, table_data):
        self._table_data = table_data
        self._queries = {}

    def table(self, name):
        if name not in self._queries:
            self._queries[name] = _FakeQuery(self._table_data.get(name, []))
        return self._queries[name]


def _client_with(**table_data):
    return _FakeClient(table_data)


def test_get_or_create_conversation_returns_existing_id(monkeypatch):
    client = _client_with(conversations=[{"id": "conv-1"}])
    monkeypatch.setattr(conversations, "get_supabase_client", lambda: client)

    result = conversations.get_or_create_conversation("tenant-1", "chat-1")

    assert result == "conv-1"
    assert client.table("conversations").eq_calls == [
        ("tenant_id", "tenant-1"),
        ("client_id", "chat-1"),
        ("channel", "telegram"),
    ]


def test_get_or_create_conversation_creates_when_missing(monkeypatch):
    client = _client_with(conversations=[])
    monkeypatch.setattr(conversations, "get_supabase_client", lambda: client)

    result = conversations.get_or_create_conversation("tenant-1", "chat-1")

    assert result == "new-id"
    assert client.table("conversations").inserted == {
        "tenant_id": "tenant-1",
        "client_id": "chat-1",
        "channel": "telegram",
    }


def test_save_message_inserts_row(monkeypatch):
    client = _client_with(messages=[])
    monkeypatch.setattr(conversations, "get_supabase_client", lambda: client)

    conversations.save_message("conv-1", "client", "Привет")

    assert client.table("messages").inserted == {
        "conversation_id": "conv-1",
        "role": "client",
        "content": "Привет",
    }


def test_get_recent_messages_returns_rows(monkeypatch):
    rows = [{"role": "client", "content": "Привет"}, {"role": "bot", "content": "Добрый день"}]
    client = _client_with(messages=rows)
    monkeypatch.setattr(conversations, "get_supabase_client", lambda: client)

    result = conversations.get_recent_messages("conv-1")

    assert result == rows
    assert client.table("messages").eq_calls == [("conversation_id", "conv-1")]
