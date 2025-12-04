// components/CreateEventForm.tsx
import React, { useMemo, useState } from "react";
import { createEvent, type CreateEventPayload } from "../api";

const MAX_BYTES = 50 * 1024 * 1024; // keep in sync with backend (50MB example)

export function CreateEventForm({ circleId, onCreated }: {
  circleId: string;
  onCreated?: (event: any) => void;
}) {
  const [eventType, setEventType] = useState("doorbell");
  const [cameraZone, setCameraZone] = useState("front");
  const [requestText, setRequestText] = useState("");
  const [severity, setSeverity] = useState<"low"|"medium"|"high">("medium");
  const [file, setFile] = useState<File | undefined>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (file && file.size > MAX_BYTES) {
      setErr(`Video is too large. Max is ${Math.round(MAX_BYTES / (1024*1024))}MB.`);
      return;
    }

    const payload: CreateEventPayload = {
      circleId,
      eventType,
      cameraZone,
      requestText,
      severity,
      occurredAt: new Date().toISOString(),
    };

    setBusy(true);
    try {
      const created = await createEvent(payload, file);
      onCreated?.(created);
      setRequestText("");
      setFile(undefined);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create event");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 520 }}>
      <label>
        Event type
        <input value={eventType} onChange={(e) => setEventType(e.target.value)} />
      </label>

      <label>
        Camera zone
        <input value={cameraZone} onChange={(e) => setCameraZone(e.target.value)} />
      </label>

      <label>
        Request text
        <textarea value={requestText} onChange={(e) => setRequestText(e.target.value)} required />
      </label>

      <label>
        Severity
        <select value={severity} onChange={(e) => setSeverity(e.target.value as any)}>
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
      </label>

      <label>
        Video (optional)
        <input
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? undefined)}
        />
      </label>

      {previewUrl && (
        <video src={previewUrl} controls style={{ width: "100%", borderRadius: 12 }} />
      )}

      {err && <div style={{ color: "crimson" }}>{err}</div>}

      <button disabled={busy}>
        {busy ? "Creating..." : "Create event"}
      </button>
    </form>
  );
}
