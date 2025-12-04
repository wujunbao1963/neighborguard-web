import { useEffect, useState } from "react";
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  type NotificationResponse,
} from "../api";
import { Link } from "react-router-dom";

type LoadingState = "idle" | "loading" | "error";

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [loading, setLoading] = useState<LoadingState>("idle");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshUnread = async () => {
    try {
      const res = await getUnreadNotificationCount();
      setUnreadCount(res.unreadCount ?? 0);
    } catch {
      // ignore polling errors
    }
  };

  const loadList = async () => {
    try {
      setLoading("loading");
      setError(null);
      const data = await getNotifications();
      const sorted = [...data].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setNotifications(sorted);
      setLoading("idle");
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Failed to load notifications");
      setLoading("error");
    }
  };

  // Poll unread count every 10s (only when visible)
  useEffect(() => {
    refreshUnread();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshUnread();
    }, 10000);

    const onFocus = () => refreshUnread();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadList();
  };

  const markReadOptimistic = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    markNotificationRead(id).catch(() => undefined);
  };

  return (
    <div style={{ position: "relative", marginLeft: 12 }}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notifications"
        style={{
          border: "1px solid rgba(148,163,184,0.6)",
          borderRadius: 999,
          padding: "6px 10px",
          background: "transparent",
          color: "inherit",
          position: "relative",
          cursor: "pointer",
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              minWidth: 16,
              height: 16,
              borderRadius: 999,
              background: "#ef4444",
              color: "#f9fafb",
              fontSize: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            marginTop: 8,
            width: 320,
            maxHeight: 420,
            overflowY: "auto",
            background: "#020617",
            border: "1px solid rgba(148,163,184,0.6)",
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.7)",
            zIndex: 50,
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid rgba(51,65,85,0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 13, color: "#e5e7eb", fontWeight: 600 }}>Notifications</span>
            <button
              type="button"
              className="btn-secondary small"
              onClick={() => loadList()}
              disabled={loading === "loading"}
            >
              {loading === "loading" ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {error && (
            <div style={{ padding: 8, fontSize: 12, color: "#fca5a5" }}>
              {error}
            </div>
          )}

          {notifications.length === 0 && loading !== "loading" && (
            <div style={{ padding: 12, fontSize: 13, color: "#9ca3af" }}>
              No notifications yet.
            </div>
          )}

          {notifications.map((n) => {
            const eventId = n.payload?.eventId as string | undefined;
            const title = n.payload?.title ?? n.type;
            const message = n.payload?.message ?? "";
            const to = eventId ? `/events/${eventId}` : "#";

            return (
              <Link
                key={n.id}
                to={to}
                onClick={() => {
                  if (!n.isRead) markReadOptimistic(n.id);
                  setOpen(false);
                }}
                style={{
                  display: "block",
                  padding: "10px 12px",
                  textDecoration: "none",
                  borderBottom: "1px solid rgba(31,41,55,0.9)",
                  background: n.isRead ? "transparent" : "#0f172a",
                  color: "#e5e7eb",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: n.isRead ? 500 : 700 }}>
                  {title}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                  {message}
                </div>
                <div style={{ fontSize: 10, color: "#6b7280", marginTop: 6 }}>
                  {new Date(n.createdAt).toLocaleString()}
                  {!n.isRead && " • new"}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

