// src/pages/CircleEventsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getMe,
  getEvents,
  type MeResponse,
  type EventResponse,
} from '../api';

type Filter = 'unresolved' | 'all' | 'mine' | 'neighbors';
type LoadingState = 'idle' | 'loading' | 'error';

export function CircleEventsPage() {
  const { circleId } = useParams<{ circleId: string }>();

  const [circleName, setCircleName] = useState('Loading…');
  const [circleAddress, setCircleAddress] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [events, setEvents] = useState<EventResponse[]>([]);
  const [eventsLoading, setEventsLoading] = useState<LoadingState>('loading');
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>('unresolved');

  useEffect(() => {
    if (!circleId) return;

    getMe()
      .then((me: MeResponse) => {
        setCurrentUserId(me.id);
        const circle = me.circles.find((c) => c.id === circleId);
        if (circle) {
          setCircleName(circle.name ?? 'Unnamed place');
          setCircleAddress(circle.address ?? '');
        } else {
          setCircleName('Unknown place');
          setCircleAddress('');
        }
      })
      .catch((err: any) => {
        console.error(err);
        setCircleName('Unknown place');
      });
  }, [circleId]);

  const reloadEvents = () => {
    if (!circleId) return;
    setEventsLoading('loading');
    setEventsError(null);

    getEvents(circleId)
      .then((list) => {
        setEvents(list);
        setEventsLoading('idle');
      })
      .catch((err: any) => {
        console.error(err);
        setEventsError(err?.message ?? 'Failed to load events');
        setEventsLoading('error');
      });
  };

  useEffect(() => {
    reloadEvents();
  }, [circleId]);

  const filteredEvents = useMemo(() => {
    return [...events]
      .filter((ev) => {
        if (filter === 'unresolved') return ev.status === 'open';
        if (filter === 'mine') {
          if (ev.isMine) return true;
          if (currentUserId && ev.createdById === currentUserId) return true;
          return false;
        }
        if (filter === 'neighbors') return ev.createdByRole === 'neighbor';
        return true; // 'all'
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime(),
      );
  }, [events, filter, currentUserId]);

  if (!circleId) {
    return (
      <div className="page">
        <section className="section">
          <div className="card">
            <div className="card-title">Circle events</div>
            <p className="card-body">
              Missing <code>circleId</code> in URL.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header + filters */}
      <section className="section">
        <div className="card">
          <div className="card-meta" style={{ marginBottom: 4 }}>
            Circle ID: {circleId}
          </div>
          <div className="card-meta" style={{ fontSize: 12 }}>
            <Link to="/">Guard Home</Link> /{' '}
            <Link to={`/circles/${circleId}`}>{circleName}</Link> /{' '}
            <span>Events</span>
          </div>
          <div className="card-title" style={{ marginTop: 8 }}>
            {circleName}
          </div>
          {circleAddress && (
            <div className="card-subtitle">{circleAddress}</div>
          )}

          <div
            style={{
              marginTop: 12,
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 12, opacity: 0.7 }}>Filter:</span>
            <button
              type="button"
              className={`btn-secondary small ${
                filter === 'unresolved' ? 'active' : ''
              }`}
              onClick={() => setFilter('unresolved')}
            >
              Unresolved
            </button>
            <button
              type="button"
              className={`btn-secondary small ${
                filter === 'all' ? 'active' : ''
              }`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`btn-secondary small ${
                filter === 'mine' ? 'active' : ''
              }`}
              onClick={() => setFilter('mine')}
            >
              Mine
            </button>
            <button
              type="button"
              className={`btn-secondary small ${
                filter === 'neighbors' ? 'active' : ''
              }`}
              onClick={() => setFilter('neighbors')}
            >
              Neighbors
            </button>
          </div>
        </div>
      </section>

      {/* Events list (filtered) */}
      <section className="section">
        <h2 className="section-title">Events</h2>
        <div className="card">
          {eventsLoading === 'loading' && (
            <p className="card-body">Loading events…</p>
          )}
          {eventsLoading === 'error' && (
            <p className="card-body" style={{ color: '#f87171' }}>
              {eventsError}
            </p>
          )}
          {eventsLoading === 'idle' && filteredEvents.length === 0 && (
            <p className="card-body">
              No events under this filter.
            </p>
          )}
          {eventsLoading === 'idle' && filteredEvents.length > 0 && (
            <div className="list">
              {filteredEvents.map((ev) => (
                <Link
                  key={ev.id}
                  to={`/events/${ev.id}`}
                  className="card event-card"
                >
                  <div className="event-title">
                    {ev.title || ev.eventType || 'Untitled event'}
                  </div>
                  <div className="event-subtitle">
                    {ev.cameraZone} • {ev.eventType} • {ev.severity}
                  </div>
                  <div className="event-meta">
                    {new Date(ev.createdAt).toLocaleString()}
                    {' • by '}
                    {ev.createdByName ?? 'Unknown'}
                    {ev.createdByRole && ` (${ev.createdByRole})`}
                    {' • '}
                    {ev.status}
                  </div>
                  {ev.videoUrl && (
                    <div className="event-tag">has video</div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
