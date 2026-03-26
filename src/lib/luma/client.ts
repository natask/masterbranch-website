const LUMA_API_BASE = "https://api.lu.ma/public/v1";

type LumaEvent = {
  api_id: string;
  name: string;
  description?: string;
  start_at?: string;
  end_at?: string;
  url?: string;
};

type LumaEventsResponse = {
  entries: { api_id: string; event: LumaEvent }[];
  has_more: boolean;
  next_cursor?: string;
};

type LumaGuest = {
  api_id: string;
  guest_name?: string;
  guest_email?: string;
  approval_status?: string;
  created_at?: string;
};

type LumaGuestsResponse = {
  entries: { api_id: string; guest: LumaGuest }[];
  has_more: boolean;
  next_cursor?: string;
};

function lumaHeaders(apiKey: string) {
  return {
    "x-luma-api-key": apiKey,
    "Content-Type": "application/json",
  };
}

export async function listEvents(apiKey: string) {
  const res = await fetch(`${LUMA_API_BASE}/calendar/list-events`, {
    headers: lumaHeaders(apiKey),
  });
  if (!res.ok) throw new Error(`Luma API error: ${res.status}`);
  const data: LumaEventsResponse = await res.json();
  return data.entries.map((e) => e.event);
}

export async function getEventGuests(apiKey: string, eventId: string) {
  const res = await fetch(
    `${LUMA_API_BASE}/event/get-guests?event_api_id=${eventId}`,
    { headers: lumaHeaders(apiKey) }
  );
  if (!res.ok) throw new Error(`Luma API error: ${res.status}`);
  const data: LumaGuestsResponse = await res.json();
  return data.entries.map((e) => e.guest);
}

export async function createEvent(
  apiKey: string,
  event: { name: string; start_at: string; end_at?: string; description?: string }
) {
  const res = await fetch(`${LUMA_API_BASE}/event/create`, {
    method: "POST",
    headers: lumaHeaders(apiKey),
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`Luma API error: ${res.status}`);
  return res.json();
}

export async function updateGuestStatus(
  apiKey: string,
  eventId: string,
  guestId: string,
  status: "approved" | "declined"
) {
  const res = await fetch(`${LUMA_API_BASE}/event/manage-guest`, {
    method: "POST",
    headers: lumaHeaders(apiKey),
    body: JSON.stringify({
      event_api_id: eventId,
      guest_api_id: guestId,
      approval_status: status,
    }),
  });
  if (!res.ok) throw new Error(`Luma API error: ${res.status}`);
  return res.json();
}
