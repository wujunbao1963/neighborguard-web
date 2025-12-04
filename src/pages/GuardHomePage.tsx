// src/pages/GuardHomePage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getHomeTasks,
  createEvent,
  setUserId,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type HomeTasksResponse,
  type EventResponse,
  type CircleSummary,
  type CreateEventPayload,
  type EventSeverity,
  type NotificationResponse,
} from '../api';

type LoadingState = 'idle' | 'loading' | 'error';

// 🔧 Dev-only users: IDs should match your DB seed
const DEV_USERS = [
  {
    id: 'f2bf0b90-14a3-4ae9-8bd9-1c6599c0c001',
    name: '吴军保',
    email: 'wu.junbao@example.com',
  },
  {
    id: 'f2bf0b90-14a3-4ae9-8bd9-1c6599c0c002',
    name: '张豪',
    email: 'zhang.hao@example.com',
  },
  {
    id: 'f2bf0b90-14a3-4ae9-8bd9-1c6599c0c003',
    name: '吴革会',
    email: 'wu.gehui@example.com',
  },
  {
    id: 'f2bf0b90-14a3-4ae9-8bd9-1c6599c0c004',
    name: '王桂芳',
    email: 'wang.guifang@example.com',
  },
  {
    id: 'f2bf0b90-14a3-4ae9-8bd9-1c6599c0c005',
    name: '崔雪薇',
    email: 'cui.xuewei@example.com',
  },
];

const DEV_USER_STORAGE_KEY = 'dev.currentUserId';

// 👉 helper: pick a “home” circle for this user
function pickDefaultCircleId(circles: CircleSummary[]): string {
  if (!circles || circles.length === 0) return '';

  // 优先 owner
  const owner = circles.find((c) => c.role === 'owner');
  if (owner) return owner.id;

  // 其次 resident / co_resident
  const resident = circles.find(
    (c) => c.role === 'resident' || c.role === 'co_resident',
  );
  if (resident) return resident.id;

  // 实在没有，就第一个
  return circles[0].id;
}

export function GuardHomePage() {
  // figure out initial user once, reuse for both states
  const initialUserId =
    typeof window === 'undefined'
      ? DEV_USERS[0].id
      : window.localStorage.getItem(DEV_USER_STORAGE_KEY) ||
        window.localStorage.getItem('x-user-id') ||
        DEV_USERS[0].id;

  const [tasks, setTasks] = useState<HomeTasksResponse | null>(null);
  const [loading, setLoading] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string>(initialUserId);

  const currentDevUser = useMemo(
    () => DEV_USERS.find((u) => u.id === currentUserId) ?? DEV_USERS[0],
    [currentUserId],
  );

  // Inbox: unread notifications (server truth)
  const [unreadNotifications, setUnreadNotifications] = useState<NotificationResponse[]>([]);
  const [notifLoading, setNotifLoading] = useState<LoadingState>('idle');
  const [notifError, setNotifError] = useState<string | null>(null);

  // create event form
  const [circleId, setCircleId] = useState<string>('');
  const [cameraZone, setCameraZone] = useState('front-door');
  const [eventType, setEventType] = useState('suspicious_person');
  const [severity, setSeverity] = useState<EventSeverity>('medium');
  const [requestText, setRequestText] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  // when currentUserId changes, sync header
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DEV_USER_STORAGE_KEY, currentUserId);
    }
    setUserId(currentUserId);
  }, [currentUserId]);

  // load tasks whenever currentUserId changes
  useEffect(() => {
    setLoading('loading');
    setError(null);
    getHomeTasks()
      .then((data) => {
        setTasks(data);
        setLoading('idle');

        // 👉 每次换用户，按角色挑一个“家”圈子出来
        const nextCircleId = pickDefaultCircleId(data.myCircles ?? []);
        setCircleId(nextCircleId);
      })
      .catch((err: any) => {
        console.error(err);
        setError(err?.message ?? 'Failed to load home tasks');
        setLoading('error');
      });
  }, [currentUserId]);

  const pendingEvents: EventResponse[] = tasks?.pendingEvents ?? [];
  const myCircles: CircleSummary[] = tasks?.myCircles ?? [];

  const loadUnreadNotifications = async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setNotifLoading('loading');
      setNotifError(null);
      const data = await getNotifications({ unreadOnly: true });
      // newest first
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setUnreadNotifications(data);
      setNotifLoading('idle');
    } catch (err: any) {
      console.error(err);
      setNotifError(err?.message ?? 'Failed to load notifications');
      setNotifLoading('error');
    }
  };

  // load + poll unread notifications (mobile-friendly)
  useEffect(() => {
    loadUnreadNotifications();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadUnreadNotifications({ silent: true });
    }, 15000);
    const onFocus = () => loadUnreadNotifications({ silent: true });
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const reloadTasks = async () => {
    try {
      setLoading('loading');
      const data = await getHomeTasks();
      setTasks(data);
      setLoading('idle');
      // ⚠️ 这里不动 circleId，避免用户自己切换后被重置
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? 'Failed to reload home tasks');
      setLoading('error');
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!circleId) {
      alert('Please choose a place.');
      return;
    }
    if (!requestText.trim()) {
      alert('Please describe what happened / your request.');
      return;
    }

    if (videoFile && videoFile.size > 50 * 1024 * 1024) {
      alert('Video is too large (max 50MB).');
      return;
    }

    const payload: CreateEventPayload = {
      circleId,
      eventType,
      cameraZone,
      title: undefined,
      description: undefined,
      requestText: requestText.trim(),
      severity,
      occurredAt: new Date().toISOString(),
    };

    try {
      setCreating(true);
      await createEvent(payload, videoFile ?? undefined);
      setRequestText('');
      setVideoFile(null);
      await reloadTasks();
      await loadUnreadNotifications({ silent: true });
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? 'Failed to create event');
    } finally {
      setCreating(false);
    }
  };

  const markNotificationReadOptimistic = (id: string) => {
    // remove from unread list immediately (server truth isRead)
    setUnreadNotifications((prev) => prev.filter((n) => n.id !== id));
    markNotificationRead(id).catch(() => undefined);
  };

  return (
    <div className="page">
      {/* Header */}
      <section className="section">
        <div className="card">
          <div className="card-title">NeighborGuard</div>
          <div className="card-subtitle">
            Keep an eye on your home and your block together with neighbors.
          </div>

          <div
            className="card-meta"
            style={{
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 18 }}>
              Current user: <strong>{currentDevUser.name}</strong> (
              {currentDevUser.email})
            </span>

            <button
              type="button"
              className="btn-secondary small"
              onClick={() =>
                document
                  .getElementById('settings')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              Settings
            </button>
          </div>

          <div className="card-meta" style={{ marginTop: 8 }}>
            {loading === 'loading' && 'Loading your circles and events…'}
            {loading === 'error' && (
              <span style={{ color: '#f87171' }}>
                {error ?? 'Failed to load home data.'}
              </span>
            )}
            {loading === 'idle' && tasks && (
              <>
                You are in {myCircles.length} place
                {myCircles.length === 1 ? '' : 's'} ·{' '}
                {unreadNotifications.length} unread notification
                {unreadNotifications.length === 1 ? '' : 's'} ·{' '}
                {pendingEvents.length} pending for you
              </>
            )}
          </div>
        </div>
      </section>

      {/* Create event form */}
      <section className="section">
        <h2 className="section-title">Create a new event</h2>
        <form className="card form" onSubmit={handleCreateEvent}>
          <div className="form-row">
            <label>Place / Circle</label>
            <select
              value={circleId}
              onChange={(e) => setCircleId(e.target.value)}
            >
              {myCircles.length === 0 && (
                <option value="">No circles yet</option>
              )}
              {myCircles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.address ? ` · ${c.address}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Camera zone</label>
            <select
              value={cameraZone}
              onChange={(e) => setCameraZone(e.target.value)}
            >
              <option value="front-door">Front door</option>
              <option value="driveway">Driveway</option>
              <option value="backyard">Backyard</option>
              <option value="side">Side / alley</option>
              <option value="street">Street view</option>
            </select>
          </div>

          <div className="form-row">
            <label>Event type</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            >
              <option value="suspicious_person">Suspicious person</option>
              <option value="suspicious_vehicle">Suspicious vehicle</option>
              <option value="package_issue">Package issue</option>
              <option value="noise">Noise / disturbance</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-row">
            <label>Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as EventSeverity)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="form-row">
            <label>What happened / Request</label>
            <textarea
              rows={3}
              value={requestText}
              onChange={(e) => setRequestText(e.target.value)}
              placeholder="Describe what you saw or what neighbors can help with…"
            />
          </div>

          <div className="form-row">
            <label>Video (optional)</label>
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/*"
              onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
            />
            {videoFile && (
              <div className="card-meta" style={{ marginTop: 6 }}>
                Selected: {videoFile.name}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={creating || !circleId || !requestText.trim()}
          >
            {creating ? 'Creating…' : 'Create event'}
          </button>
        </form>
      </section>

      {/* Inbox: unread notifications (server truth) */}
      <section className="section">
        <h2 className="section-title">Inbox</h2>
        <div className="card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <h3 className="card-subtitle" style={{ marginBottom: 0 }}>
              Unread notifications
            </h3>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn-secondary small"
                onClick={() => loadUnreadNotifications()}
                disabled={notifLoading === 'loading'}
              >
                {notifLoading === 'loading' ? 'Refreshing…' : 'Refresh'}
              </button>

              <button
                type="button"
                className="btn-secondary small"
                onClick={async () => {
                  await markAllNotificationsRead().catch(() => undefined);
                  setUnreadNotifications([]);
                }}
                disabled={unreadNotifications.length === 0}
              >
                Mark all read
              </button>
            </div>
          </div>

          {notifError && (
            <p className="card-body" style={{ color: '#f87171' }}>
              {notifError}
            </p>
          )}

          {notifLoading === 'loading' && unreadNotifications.length === 0 && (
            <p className="card-body">Loading notifications…</p>
          )}

          {notifLoading !== 'loading' && unreadNotifications.length === 0 && (
            <p className="card-body">No unread notifications.</p>
          )}

          {unreadNotifications.length > 0 && (
            <div className="list" style={{ marginTop: 10 }}>
              {unreadNotifications.map((n) => {
                const eventId = n.payload?.eventId as string | undefined;
                const title = n.payload?.title || n.type;
                const subtitle =
                  n.payload?.message ||
                  (n.payload?.circleName ? `${n.payload.circleName}` : '');

                const body = (
                  <>
                    <div className="event-title">{title}</div>
                    {subtitle && <div className="event-subtitle">{subtitle}</div>}
                    <div className="event-meta">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </>
                );

                if (eventId) {
                  return (
                    <Link
                      key={n.id}
                      to={`/events/${eventId}`}
                      className="card event-card"
                      onClick={() => markNotificationReadOptimistic(n.id)}
                    >
                      {body}
                    </Link>
                  );
                }

                return (
                  <div
                    key={n.id}
                    className="card event-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => markNotificationReadOptimistic(n.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        markNotificationReadOptimistic(n.id);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {body}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* My pending events */}
      <section className="section">
        <h2 className="section-title">My pending events</h2>
        <div className="card">
          {loading === 'loading' && (
            <p className="card-body">Loading pending events…</p>
          )}
          {loading === 'idle' && pendingEvents.length === 0 && (
            <p className="card-body">
              No events require your resolution right now.
            </p>
          )}
          {loading === 'idle' && pendingEvents.length > 0 && (
            <div className="list">
              {pendingEvents.map((ev) => (
                <Link
                  key={ev.id}
                  to={`/events/${ev.id}`}
                  className="card event-card"
                >
                  <div className="event-title">
                    {ev.title || ev.eventType || 'Untitled event'}
                  </div>
                  <div className="event-subtitle">
                    {ev.circleName} • {ev.cameraZone} • {ev.severity}
                  </div>
                  <div className="event-meta">
                    {new Date(ev.createdAt).toLocaleString()}
                    {' • by '}
                    {ev.createdByName ?? 'Unknown'}
                    {ev.createdByRole && ` (${ev.createdByRole})`}
                    {' • '}
                    {ev.status}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* My places */}
      <section className="section">
        <h2 className="section-title">My places</h2>
        <div className="card">
          {loading === 'loading' && <p className="card-body">Loading circles…</p>}
          {loading === 'idle' && myCircles.length === 0 && (
            <p className="card-body">You haven&apos;t joined any circles yet.</p>
          )}
          {loading === 'idle' && myCircles.length > 0 && (
            <div className="list">
              {myCircles.map((c) => (
                <div key={c.id} className="card" style={{ padding: 12 }}>
                  <div className="card-title">{c.name}</div>
                  {c.address && <div className="card-subtitle">{c.address}</div>}
                  <div className="card-meta">Your role: {c.role}</div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Link className="btn-secondary small" to={`/circles/${c.id}`}>
                      Open
                    </Link>
                    <Link className="btn-secondary small" to={`/circles/${c.id}/events`}>
                      Event history
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Settings */}
      <section className="section" id="settings">
        <h2 className="section-title">Settings</h2>

        <div className="card">
          <h3 className="card-subtitle">Developer</h3>

          <div className="card-meta" style={{ marginTop: 8 }}>
            Switch the current user (dev only). This updates the <code>x-user-id</code> header.
          </div>

          <div
            className="card-meta"
            style={{
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 12 }}>Dev current user:</span>

            <select
              value={currentUserId}
              onChange={(e) => setCurrentUserId(e.target.value)}
              style={{ fontSize: 13, padding: '4px 8px', borderRadius: 8 }}
            >
              {DEV_USERS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>
    </div>
  );
}
