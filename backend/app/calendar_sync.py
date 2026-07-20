import json
from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from google.oauth2 import service_account
from googleapiclient.discovery import build

from app.config import get_settings
from app.db import get_supabase_client

SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]
SYNC_WINDOW_DAYS = 90


def _load_service_account_info() -> dict[str, Any]:
    settings = get_settings()
    if not settings.google_service_account_json:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON is not configured on the server")
    return json.loads(settings.google_service_account_json)


def get_service_account_email() -> str:
    """The email the owner shares their Google Calendar with (read access is
    enough) — surfaced in the dashboard's Календарь connection panel."""
    info = _load_service_account_info()
    return info["client_email"]


def _build_calendar_service():
    info = _load_service_account_info()
    credentials = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    return build("calendar", "v3", credentials=credentials, cache_discovery=False)


async def upsert_availability(tenant_id: str, date_str: str, is_available: bool, event_details: str) -> None:
    """Mirrors dashboard/src/lib/availability.ts's upsertAvailability — same
    check-then-insert-or-update shape, since availability_cache has no
    unique constraint on (tenant_id, date) to upsert(onConflict) against."""
    client = get_supabase_client()
    existing = (
        client.table("availability_cache")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("date", date_str)
        .limit(1)
        .execute()
    ).data

    if existing:
        client.table("availability_cache").update(
            {"is_available": is_available, "event_details": event_details}
        ).eq("id", existing[0]["id"]).execute()
        return

    client.table("availability_cache").insert(
        {"tenant_id": tenant_id, "date": date_str, "is_available": is_available, "event_details": event_details}
    ).execute()


async def sync_calendar(tenant_id: str, calendar_id: str) -> int:
    """Reads events on `calendar_id` for the next SYNC_WINDOW_DAYS days and
    makes the real calendar authoritative over every day in that window --
    days with at least one event are marked unavailable (event_details set
    to that day's event summary/summaries joined by ", "), and every other
    day in the window is explicitly marked available, clearing out any
    stale/placeholder row left over from testing or a previous sync where
    that day used to have an event but no longer does. Returns the count of
    days marked unavailable.

    (Earlier version only ever asserted busy days and left everything else
    untouched -- meaning fake test data seeded directly into the database,
    or a cancelled event from a prior sync, could never be corrected by a
    real sync and would linger indefinitely.)"""
    service = _build_calendar_service()

    today = date.today()
    time_min = today.isoformat() + "T00:00:00Z"
    time_max = (today + timedelta(days=SYNC_WINDOW_DAYS)).isoformat() + "T00:00:00Z"

    response = (
        service.events()
        .list(
            calendarId=calendar_id,
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )

    events_by_day: dict[str, list[str]] = defaultdict(list)
    for event in response.get("items", []):
        start = event.get("start", {})
        day_str = start.get("date") or (start.get("dateTime") or "")[:10]
        if not day_str:
            continue
        summary = event.get("summary") or "Занято"
        events_by_day[day_str].append(summary)

    for offset in range(SYNC_WINDOW_DAYS):
        day_str = (today + timedelta(days=offset)).isoformat()
        if day_str in events_by_day:
            await upsert_availability(tenant_id, day_str, False, ", ".join(events_by_day[day_str]))
        else:
            await upsert_availability(tenant_id, day_str, True, "")

    return len(events_by_day)
