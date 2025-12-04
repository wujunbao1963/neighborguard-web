// src/pages/CircleDashboardPage.tsx
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getMe,
  getEvents,
  getCircleMembers,
  addCircleMember,
  removeCircleMember,
  type MeResponse,
  type EventResponse,
  type CircleMemberResponse,
  type CircleMemberRole,
} from '../api';

type LoadingState = 'idle' | 'loading' | 'error';

export function CircleDashboardPage() {
  const { circleId } = useParams<{ circleId: string }>();

  const [circleName, setCircleName] = useState('Loading…');
  const [circleAddress, setCircleAddress] = useState('');
  const [houseType, setHouseType] = useState('');
  const [cameraZones, setCameraZones] = useState<string[]>([]);
  const [isOwner, setIsOwner] = useState(false);

  const [members, setMembers] = useState<CircleMemberResponse[]>([]);
  const [events, setEvents] = useState<EventResponse[]>([]);

  const [metaLoading, setMetaLoading] = useState<LoadingState>('loading');
  const [metaError, setMetaError] = useState<string | null>(null);

  const [membersLoading, setMembersLoading] = useState<LoadingState>('loading');
  const [membersError, setMembersError] = useState<string | null>(null);

  const [eventsLoading, setEventsLoading] = useState<LoadingState>('loading');
  const [eventsError, setEventsError] = useState<string | null>(null);

  // add member form
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] =
    useState<CircleMemberRole>('neighbor');
  const [addingMember, setAddingMember] = useState(false);

  // basic circle info & whether current user is owner
  useEffect(() => {
    if (!circleId) return;

    setMetaLoading('loading');
    setMetaError(null);

    getMe()
      .then((me: MeResponse) => {
        const circle = me.circles.find((c) => c.id === circleId);
        if (!circle) {
          setCircleName('Unknown place');
          setCircleAddress('');
          setHouseType('');
          setCameraZones([]);
          setIsOwner(false);
        } else {
          setCircleName(circle.name ?? 'Unnamed place');
          setCircleAddress(circle.address ?? '');
          setHouseType(circle.houseType ?? '');
          setCameraZones(circle.cameraZonesConfig ?? []);
          setIsOwner(circle.ownerId === me.id);
        }
        setMetaLoading('idle');
      })
      .catch((err: any) => {
        console.error(err);
        setMetaError(err?.message ?? 'Failed to load circle');
        setMetaLoading('error');
      });
  }, [circleId]);

  // members
  const reloadMembers = () => {
    if (!circleId) return;
    setMembersLoading('loading');
    setMembersError(null);

    getCircleMembers(circleId)
      .then((list) => {
        setMembers(list);
        setMembersLoading('idle');
      })
      .catch((err: any) => {
        console.error(err);
        setMembersError(err?.message ?? 'Failed to load members');
        setMembersLoading('error');
      });
  };

  useEffect(() => {
    reloadMembers();
  }, [circleId]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!circleId) return;
    if (!newMemberEmail.trim()) {
      alert('Please enter member email.');
      return;
    }

    try {
      setAddingMember(true);
      await addCircleMember(circleId, {
        email: newMemberEmail.trim(),
        name: newMemberName.trim() || undefined,
        role: newMemberRole,
      });
      setNewMemberEmail('');
      setNewMemberName('');
      setNewMemberRole('neighbor');
      reloadMembers();
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!circleId) return;
    if (!window.confirm('Remove this member from the circle?')) return;

    try {
      await removeCircleMember(circleId, memberId);
      reloadMembers();
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? 'Failed to remove member');
    }
  };

  // events → all for this circle
  useEffect(() => {
    if (!circleId) return;

    setEventsLoading('loading');
    setEventsError(null);

    getEvents(circleId)
      .then((list) => {
        const sorted = [...list].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime(),
        );
        setEvents(sorted);
        setEventsLoading('idle');
      })
      .catch((err: any) => {
        console.error(err);
        setEventsError(err?.message ?? 'Failed to load events');
        setEventsLoading('error');
      });
  }, [circleId]);

  if (!circleId) {
    return (
      <div className="page">
        <section className="section">
          <div className="card">
            <div className="card-title">Circle</div>
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
      {/* 概览 */}
      <section className="section">
        <div className="card">
          <div className="card-meta" style={{ marginBottom: 4 }}>
            Circle ID: {circleId}
          </div>
          <div className="card-meta" style={{ fontSize: 12 }}>
            <Link to="/">Guard Home</Link> / <span>{circleName}</span>
          </div>
          <div className="card-title" style={{ marginTop: 8 }}>
            {circleName}
          </div>
          {circleAddress && (
            <div className="card-subtitle">{circleAddress}</div>
          )}
          <div className="card-meta" style={{ marginTop: 8 }}>
            {metaLoading === 'loading' && 'Loading circle info…'}
            {metaLoading === 'error' && (
              <span style={{ color: '#f87171' }}>
                {metaError ?? 'Failed to load circle'}
              </span>
            )}
            {metaLoading === 'idle' && (
              <>
                House type: {houseType || 'N/A'}
                {' • '}
                Camera zones:{' '}
                {cameraZones.length
                  ? cameraZones.join(', ')
                  : 'Not configured'}
                {' • '}
                You are: {isOwner ? 'Owner' : 'Member'}
              </>
            )}
          </div>
        </div>
      </section>

      {/* 成员管理 */}
      <section className="section">
        <h2 className="section-title">Members</h2>
        <div className="card">
          {membersLoading === 'loading' && (
            <p className="card-body">Loading members…</p>
          )}
          {membersLoading === 'error' && (
            <p className="card-body" style={{ color: '#f87171' }}>
              {membersError}
            </p>
          )}
          {membersLoading === 'idle' && members.length === 0 && (
            <p className="card-body">No members in this circle yet.</p>
          )}
          {membersLoading === 'idle' && members.length > 0 && (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
              }}
            >
              {members.map((m) => (
                <li
                  key={m.id}
                  style={{
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(31,41,55,0.8)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {m.userName || '(unnamed user)'}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: '#9ca3af',
                      }}
                    >
                      {m.userEmail}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        textTransform: 'capitalize',
                        color: '#9ca3af',
                      }}
                    >
                      {m.role}
                    </span>
                    {isOwner && m.role !== 'owner' && (
                      <button
                        type="button"
                        className="btn-secondary small"
                        onClick={() => handleRemoveMember(m.id)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {isOwner && (
            <form
              className="form"
              style={{ marginTop: 12 }}
              onSubmit={handleAddMember}
            >
              <div className="form-row">
                <label>Add member by email</label>
                <input
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="neighbor@example.com"
                />
              </div>
              <div className="form-row">
                <label>Name (optional)</label>
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Neighbor name / nickname"
                />
              </div>
              <div className="form-row">
                <label>Role</label>
                <select
                  value={newMemberRole}
                  onChange={(e) =>
                    setNewMemberRole(e.target.value as CircleMemberRole)
                  }
                >
                  <option value="resident">Resident</option>
                  <option value="neighbor">Neighbor</option>
                  <option value="observer">Observer</option>
                </select>
              </div>
              <button
                type="submit"
                className="btn-primary small"
                disabled={addingMember || !newMemberEmail.trim()}
              >
                {addingMember ? 'Adding…' : 'Add member'}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* 最近事件摘要 + View all events */}
      <section className="section">
        <h2 className="section-title">Recent events</h2>
        <div className="card">
          {eventsLoading === 'loading' && (
            <p className="card-body">Loading events…</p>
          )}
          {eventsLoading === 'error' && (
            <p className="card-body" style={{ color: '#f87171' }}>
              {eventsError}
            </p>
          )}
          {eventsLoading === 'idle' && events.length === 0 && (
            <p className="card-body">
              No events in this place yet.
            </p>
          )}
          {eventsLoading === 'idle' && events.length > 0 && (
            <>
              <div className="list">
                {events.slice(0, 5).map((ev) => (
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
              <div style={{ marginTop: 8 }}>
                <Link
                  to={`/circles/${circleId}/events`}
                  className="btn-secondary small"
                >
                  View all events
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
