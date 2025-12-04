// src/api.ts

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, ""); // -> http://localhost:3000

export function toMediaUrl(url?: string) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${API_ORIGIN}${url}`;
  return `${API_ORIGIN}/${url}`;
}

/** ---------- Types ---------- */

export type EventSeverity = "low" | "medium" | "high";
export type EventStatus = "open" | "resolved";

export type EventCreatorRole = "owner" | "resident" | "neighbor" | "observer" | "unknown";

export type CircleSummary = {
  id: string;
  name: string;
  address?: string;
  role: string;
  [key: string]: any;
};

export type EventResponse = {
  id: string;
  circleId: string;
  circleName?: string;
  cameraZone: string;
  eventType: string;
  requestText: string;
  title?: string;
  description?: string;
  severity: EventSeverity;
  status: EventStatus;
  occurredAt?: string;
  createdAt: string;
  updatedAt: string;
  videoAssetId?: string;
  videoUrl?: string;
  createdById?: string;
  createdByName?: string;
  createdByEmail?: string;
  createdByRole?: EventCreatorRole;
  isMine: boolean;
  myRoleInCircle: EventCreatorRole;
  canEditEvent: boolean;
  canChangeResolution: boolean;
  [key: string]: any;
};

export type NotificationResponse = {
  id: string;
  type: string;
  payload: any;
  isRead: boolean;
  createdAt: string;
  [key: string]: any;
};

export type HomeTasksResponse = {
  inboxNewEvents: EventResponse[];
  inboxNotifications: NotificationResponse[];
  pendingEvents: EventResponse[];
  myCircles: CircleSummary[];
  [key: string]: any;
};

export type CreateEventPayload = {
  circleId: string;
  eventType: string;
  cameraZone: string;
  requestText: string;

  title?: string;
  description?: string;

  severity?: EventSeverity;
  occurredAt?: string; // ISO string
  videoAssetId?: string; // set after upload
  [key: string]: any;
};

export type UploadVideoResponse = {
  videoAssetId: string;
  url: string;
  [key: string]: any;
};

export type MeResponse = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  circles: Array<{ id: string; name: string; address?: string; [key: string]: any }>;
  [key: string]: any;
};

export type UpdateEventStatusPayload = {
  status?: EventStatus;
  resolution?: string;
  [key: string]: any;
};

export type CircleMemberRole = "owner" | "resident" | "neighbor" | "observer";

export type CircleMemberResponse = {
  id: string;
  circleId: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: CircleMemberRole;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
};

export type AddCircleMemberPayload = {
  email: string;
  name?: string;
  role?: CircleMemberRole;
  [key: string]: any;
};

export type EventCommentResponse = {
  id: string;
  eventId: string;
  circleId: string;
  userId: string;
  userName: string;
  userEmail: string;
  body: string;
  type: string;
  createdAt: string;
  [key: string]: any;
};

export type CreateEventCommentPayload = {
  body: string;
  type?: string;
  [key: string]: any;
};

export type EventNoteResponse = {
  id: string;
  eventId: string;
  circleId: string;
  userId: string;
  userName: string;
  userEmail: string;
  body: string;
  type: string;
  createdAt: string;
  [key: string]: any;
};
export type EventComment = EventNoteResponse;

export type CreateEventNotePayload = {
  body: string;
  type?: string;
  [key: string]: any;
};

/** ---------- Auth header helpers (dev “current user”) ---------- */

const DEV_USER_STORAGE_KEYS = [
  "dev.currentUserId", // recommended dev key
  "x-user-id", // old key
  "ng_current_user_id",
  "ngUserEmail",
];

export function setUserId(userId: string | null) {
  if (typeof window === "undefined" || !window.localStorage) return;
  const ls = window.localStorage;

  if (!userId) {
    DEV_USER_STORAGE_KEYS.forEach((k) => ls.removeItem(k));
    return;
  }

  // main dev key
  ls.setItem("dev.currentUserId", userId);
  // keep a couple of aliases for compatibility
  ls.setItem("x-user-id", userId);
}

export function getUserId() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  const ls = window.localStorage;

  for (const key of DEV_USER_STORAGE_KEYS) {
    const v = ls.getItem(key);
    if (v) return v;
  }
  return null;
}

/** ---------- Core fetch ---------- */

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const userId = getUserId();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(userId
        ? {
            // send both for flexibility: backend can read either
            "x-user-id": userId,
          }
        : {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return (await res.text()) as unknown as T;
  }
  return (await res.json()) as T;
}

/** ---------- Exports your pages expect ---------- */

export async function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/me");
}

export async function getHomeTasks(): Promise<HomeTasksResponse> {
  try {
    return await apiFetch<HomeTasksResponse>("/home/tasks");
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    // If backend doesn't have /home/tasks, build it client-side.
    if (msg.includes("Cannot GET /home/tasks") || msg.includes("404")) {
      return buildHomeTasksFallback();
    }
    throw err;
  }
}

async function buildHomeTasksFallback(): Promise<HomeTasksResponse> {
  // 1) circles from /me
  const me = await getMe();

  const myCircles: CircleSummary[] = (me.circles ?? []).map((c: any) => ({
    id: c.id,
    name: c.name ?? "Unnamed place",
    address: c.address ?? undefined,
    role: c.ownerId && me.id && c.ownerId === me.id ? "owner" : "neighbor",
  }));

  // 2) events from all circles
  const allEventsNested = await Promise.all(
    myCircles.map(async (c) => {
      try {
        return await getEvents(c.id);
      } catch {
        return [] as EventResponse[];
      }
    }),
  );
  const allEvents = allEventsNested.flat();

  const openEvents = allEvents.filter((ev) => ev.status === "open");

  // pending = same as backend HomeService: canChangeResolution + open
const pendingEvents = openEvents.filter(
  (ev) => ev.status === "open",
);


  // 3) unread notifications
  const inboxNotifications = await getNotifications({ unreadOnly: true });

  // 4) inboxNewEvents: try event_created notifications; fallback to last 24h open events
  const eventCreatedNotifs = inboxNotifications.filter(
    (n) => n?.type === "event_created" && n?.payload?.eventId,
  );

  const seen = new Set<string>();
  const eventIds: string[] = [];
  for (const n of eventCreatedNotifs) {
    const id = String(n.payload.eventId);
    if (!seen.has(id)) {
      seen.add(id);
      eventIds.push(id);
    }
  }

  let inboxNewEvents: EventResponse[] = [];

  if (eventIds.length > 0) {
    const fetched = await Promise.all(
      eventIds.map(async (id) => {
        try {
          return await getEvent(id);
        } catch {
          return null;
        }
      }),
    );
    inboxNewEvents = fetched.filter(Boolean) as EventResponse[];
  } else {
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    inboxNewEvents = openEvents.filter((ev) => {
      const t = new Date(ev.createdAt).getTime();
      return now - t < ONE_DAY_MS;
    });
  }

  return {
    inboxNewEvents,
    inboxNotifications,
    pendingEvents,
    myCircles,
  };
}

/** ---------- Events ---------- */

export async function getEvents(circleId: string): Promise<EventResponse[]> {
  const qs = new URLSearchParams({ circleId });
  return apiFetch<EventResponse[]>(`/events?${qs.toString()}`);
}

export async function getEvent(id: string): Promise<EventResponse> {
  return apiFetch<EventResponse>(`/events/${id}`);
}

export async function createEventJson(payload: CreateEventPayload): Promise<EventResponse> {
  return apiFetch<EventResponse>("/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function uploadVideo(file: File): Promise<UploadVideoResponse> {
  const fd = new FormData();
  fd.append("file", file);
  return apiFetch<UploadVideoResponse>("/upload/video", {
    method: "POST",
    body: fd,
  });
}

// multipart version
export async function createEventMultipart(
  payload: CreateEventPayload,
  file?: File,
): Promise<EventResponse> {
  const fd = new FormData();
  Object.entries(payload).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") fd.append(k, String(v));
  });
  if (file) fd.append("file", file);

  return apiFetch<EventResponse>("/events", {
    method: "POST",
    body: fd,
  });
}

// High-level createEvent used in GuardHomePage
export async function createEvent(
  payload: CreateEventPayload,
  file?: File,
): Promise<EventResponse> {
  if (!file) return createEventJson(payload);

  try {
    return await createEventMultipart(payload, file);
  } catch {
    const up = await uploadVideo(file);
    return createEventJson({ ...payload, videoAssetId: up.videoAssetId });
  }
}

export async function updateEventStatus(
  id: string,
  body: UpdateEventStatusPayload,
): Promise<EventResponse> {
  return apiFetch<EventResponse>(`/events/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const patchEventStatus = updateEventStatus;

/** ---------- Event comments / notes ---------- */

export async function listEventComments(eventId: string): Promise<EventCommentResponse[]> {
  return apiFetch<EventCommentResponse[]>(`/events/${eventId}/comments`);
}

export async function createEventComment(
  eventId: string,
  body: CreateEventCommentPayload,
): Promise<EventCommentResponse> {
  return apiFetch<EventCommentResponse>(`/events/${eventId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// aliases
export const getEventComments = listEventComments;
export const addEventComment = createEventComment;

export async function listEventNotes(eventId: string): Promise<EventNoteResponse[]> {
  return apiFetch<EventNoteResponse[]>(`/events/${eventId}/notes`);
}

export async function createEventNote(
  eventId: string,
  body: CreateEventNotePayload,
): Promise<EventNoteResponse> {
  return apiFetch<EventNoteResponse>(`/events/${eventId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// aliases
export const getEventNotes = listEventNotes;
export const addEventNote = createEventNote;

/** ---------- Circles ---------- */

export async function getCircles(): Promise<
  Array<{ id: string; name: string; address?: string; [k: string]: any }>
> {
  return apiFetch<Array<{ id: string; name: string; address?: string; [k: string]: any }>>(`/circles`);
}

export async function getCircleMembers(circleId: string): Promise<CircleMemberResponse[]> {
  return apiFetch<CircleMemberResponse[]>(`/circles/${circleId}/members`);
}

export async function addCircleMember(
  circleId: string,
  dto: AddCircleMemberPayload,
): Promise<CircleMemberResponse> {
  return apiFetch<CircleMemberResponse>(`/circles/${circleId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
}

export async function removeCircleMember(
  circleId: string,
  memberId: string,
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/circles/${circleId}/members/${memberId}`, {
    method: "DELETE",
  });
}

/** ---------- Notifications ---------- */


export type NotificationItem = NotificationResponse;

export async function getNotifications(params?: { unreadOnly?: boolean }) {
  const qs = new URLSearchParams();
  if (params?.unreadOnly) qs.set("unreadOnly", "true");
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiFetch<NotificationResponse[]>(`/notifications${suffix}`);
}

export async function getUnreadNotificationCount(): Promise<{ unreadCount: number }> {
  return apiFetch<{ unreadCount: number }>(`/notifications/unread-count`);
}

export async function markNotificationRead(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/notifications/mark-all-read`, { method: "POST" });
}
/** ---------- Health ---------- */

export async function health(): Promise<{
  ok: boolean;
  db: string;
  timestamp: string;
  [k: string]: any;
}> {
  return apiFetch(`/health`);
}
