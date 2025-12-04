// src/pages/EventDetailPage.tsx
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getEvent,
  getEventNotes,
  addEventNote,
  patchEventStatus,
  toMediaUrl,
  type EventResponse,
  type EventComment,
} from '../api';

type LoadingState = 'idle' | 'loading' | 'error';

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();

  const [event, setEvent] = useState<EventResponse | null>(null);
  const [eventLoading, setEventLoading] = useState<LoadingState>('loading');
  const [eventError, setEventError] = useState<string | null>(null);

  const [notes, setNotes] = useState<EventComment[]>([]);
  const [notesLoading, setNotesLoading] = useState<LoadingState>('loading');
  const [notesError, setNotesError] = useState<string | null>(null);
  const [newNoteBody, setNewNoteBody] = useState('');

  // Resolution UI (MVP): no status dropdown, only "Close" action
  const [resolutionNote, setResolutionNote] = useState('');
  const [savingResolution, setSavingResolution] = useState(false);
  const [addingNote, setAddingNote] = useState(false);

  // Load event detail
  useEffect(() => {
    if (!eventId) return;

    setEventLoading('loading');
    setEventError(null);

    getEvent(eventId)
      .then((ev) => {
        setEvent(ev);
        setResolutionNote((ev as any).resolutionNote ?? (ev as any).resolution ?? '');
        setEventLoading('idle');
      })
      .catch((err: any) => {
        console.error(err);
        setEventError(err?.message ?? 'Failed to load event');
        setEventLoading('error');
      });
  }, [eventId]);

  // Load notes (used to be comments)
  useEffect(() => {
    if (!eventId) return;

    setNotesLoading('loading');
    setNotesError(null);

    getEventNotes(eventId)
      .then((list) => {
        setNotes(list);
        setNotesLoading('idle');
      })
      .catch((err: any) => {
        console.error(err);
        setNotesError(err?.message ?? 'Failed to load notes');
        setNotesLoading('error');
      });
  }, [eventId]);

  const handleCloseEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !event) return;

    // already resolved → lock, even for owner
    if (event.status === 'resolved') {
      alert('This event is already resolved and cannot be modified.');
      return;
    }

    // require note when resolving (keep your original rule)
    if (!resolutionNote.trim()) {
      alert('Please add a short resolution note before closing the event.');
      return;
    }

    try {
      setSavingResolution(true);

      const updated = await patchEventStatus(eventId, {
        status: 'resolved',
        resolution: resolutionNote,
      });

      setEvent(updated);
      setResolutionNote((updated as any).resolutionNote ?? (updated as any).resolution ?? '');
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? 'Failed to close event');
    } finally {
      setSavingResolution(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;

    const body = newNoteBody.trim();
    if (!body) return;

    try {
      setAddingNote(true);

      const created = await addEventNote(eventId, {
        body,
        type: 'comment',
      });

      setNotes((prev) => [...prev, created]);
      setNewNoteBody('');
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? 'Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  if (!eventId) {
    return (
      <div className="page">
        <section className="section">
          <div className="card">
            <div className="card-title">No event id</div>
            <p className="card-body">Missing event id in URL.</p>
          </div>
        </section>
      </div>
    );
  }

  if (eventLoading === 'loading') {
    return (
      <div className="page">
        <section className="section">
          <div className="card">
            <div className="card-title">Loading event…</div>
            <p className="card-body">Please wait.</p>
          </div>
        </section>
      </div>
    );
  }

  if (eventLoading === 'error' || !event) {
    return (
      <div className="page">
        <section className="section">
          <div className="card">
            <div className="card-title">Event not available</div>
            <p className="card-body">
              {eventError ??
                'We could not load this event. It may have been deleted or you do not have access.'}
            </p>
            <div style={{ marginTop: 12 }}>
              <Link to="/" className="btn-secondary">
                Back to Guard Home
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const ev = event;
  const isResolved = ev.status === 'resolved';
  const canClose = ev.canChangeResolution && !isResolved;

  return (
    <div className="page">
      {/* Header / breadcrumb */}
      <section className="section">
        <div className="card">
          <div className="card-meta" style={{ fontSize: 12, marginBottom: 4 }}>
            Event ID: {ev.id}
          </div>
          <div className="card-meta" style={{ fontSize: 12 }}>
            <Link to="/">Guard Home</Link> /{' '}
            <Link to={`/circles/${ev.circleId}`}>{ev.circleName}</Link> /{' '}
            <Link to={`/circles/${ev.circleId}/events`}>Events</Link> /{' '}
            <span>{ev.title || ev.eventType || 'Event detail'}</span>
          </div>

          <h1 className="page-title" style={{ marginTop: 8 }}>
            {ev.title || ev.eventType || 'Event detail'}
          </h1>

          <div className="card-meta" style={{ marginTop: 4 }}>
            <span>{ev.circleName}</span> · <span>{ev.cameraZone}</span> ·{' '}
            <span>{ev.severity}</span> · <span>{ev.status}</span>
          </div>

          <div className="card-meta" style={{ marginTop: 4 }}>
            Reported at {new Date(ev.createdAt).toLocaleString()}
            {ev.createdByName && (
              <>
                {' '}
                · by {ev.createdByName}
                {ev.createdByRole && ` (${ev.createdByRole})`}
              </>
            )}
          </div>

          {ev.videoUrl && (
            <div className="video-container" style={{ marginTop: 16 }}>
              <video
                controls
                style={{ width: '100%', borderRadius: 12 }}
                src={toMediaUrl(ev.videoUrl)}
              />
            </div>
          )}
        </div>
      </section>

      {/* What happened / request */}
      <section className="section">
        <div className="card">
          <div className="card-title">
            What happened / Request from the reporter
          </div>
          <p
            className="card-body"
            style={{ whiteSpace: 'pre-line', marginTop: 8 }}
          >
            {ev.requestText}
          </p>
        </div>
      </section>

      {/* Notes / comments */}
      <section className="section">
        <div className="card">
          <div className="card-title">Conversation / Notes</div>

          {notesLoading === 'loading' && (
            <p className="card-body" style={{ marginTop: 8 }}>
              Loading notes…
            </p>
          )}

          {notesLoading === 'error' && (
            <p
              className="card-body"
              style={{ marginTop: 8, color: '#f97373' }}
            >
              {notesError}
            </p>
          )}

          {notesLoading === 'idle' && notes.length === 0 && (
            <p className="card-body" style={{ marginTop: 8 }}>
              No notes yet. Be the first to leave a note for your neighbors.
            </p>
          )}

          {notesLoading === 'idle' && notes.length > 0 && (
            <div className="list" style={{ marginTop: 8 }}>
              {notes.map((note) => (
                <div
                  key={note.id}
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    border: '1px solid rgba(148,163,184,0.4)',
                    background: 'rgba(249,250,251, 0.9)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#111827',
                        }}
                      >
                        {note.userName}
                      </span>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>
                        {note.userEmail}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                      {new Date(note.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 13,
                      color: '#111827',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {note.body}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new note */}
          {!isResolved ? (
            <form
              onSubmit={handleAddNote}
              className="form"
              style={{
                marginTop: 12,
                borderTop: '1px solid rgba(148,163,184,0.4)',
                paddingTop: 12,
              }}
            >
              <div className="form-row">
                <label>Leave a note</label>
                <textarea
                  rows={2}
                  value={newNoteBody}
                  onChange={(e) => setNewNoteBody(e.target.value)}
                  placeholder="Share what you found (e.g. checked your own cameras, talked to someone, saw the same person elsewhere)…"
                />
              </div>
              <button
                type="submit"
                className="btn-secondary small"
                disabled={addingNote || !newNoteBody.trim()}
              >
                {addingNote ? 'Sending…' : 'Send note'}
              </button>
            </form>
          ) : (
            <p
              className="card-meta"
              style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}
            >
              This event is resolved; notes are read-only.
            </p>
          )}
        </div>
      </section>

      {/* Resolution / status (MVP) */}
      {ev.canChangeResolution && (
        <section className="section">
          <div className="card">
            <div className="card-title">Resolution</div>

            {/* Read-only once resolved */}
            {isResolved ? (
              <div className="card-body" style={{ marginTop: 8 }}>
                <div style={{ fontSize: 14, marginBottom: 8 }}>
                  Status: <strong>{ev.status}</strong>
                </div>
                <div style={{ fontSize: 14, whiteSpace: 'pre-line' }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    Resolution note
                  </div>
                  {(ev as any).resolutionNote && String((ev as any).resolutionNote).trim().length > 0
                    ? (ev as any).resolutionNote
                    : 'No resolution note.'}
                </div>
                <p
                  className="card-meta"
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: '#9ca3af',
                  }}
                >
                  This event is resolved. Resolution is locked and cannot be edited.
                </p>
              </div>
            ) : (
              <form onSubmit={handleCloseEvent} className="form" style={{ marginTop: 12 }}>
                <div className="form-row">
                  <label>Resolution note</label>
                  <textarea
                    rows={3}
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="What did you or neighbors do? ..."
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!canClose || savingResolution}
                >
                  {savingResolution ? 'Closing…' : 'Close / Resolve event'}
                </button>
              </form>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

