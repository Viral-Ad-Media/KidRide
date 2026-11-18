import React, { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Modal } from './UIComponents';
import { apiRequest, getStoredToken } from '../services/api';

// Admin only: what the parent and the driver of a ride said to each other in
// the app's chat. The chat closes for both of them when the trip ends; KidRide
// keeps a compressed copy for safety. It is opened here only to look into an
// incident or a complaint, and the server logs each time it is read.

interface RecordedMessage {
  id: string;
  body: string;
  from: 'parent' | 'driver';
  sentAt: string;
  readAt: string | null;
}

const when = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

export const ChatRecordButton: React.FC<{ rideId: string }> = ({ rideId }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<RecordedMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const titleId = `chat-record-${rideId}`;

  const show = () => {
    setOpen(true);
    setMessages(null);
    setError(null);
    apiRequest<{ messages: RecordedMessage[] }>(`/rides/${rideId}/messages`, { token: getStoredToken() })
      .then((result) => setMessages(result.messages || []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the chat record.'));
  };

  return (
    <>
      <button type="button" onClick={show} className="rounded-full bg-surface-2 px-4 py-2 text-sm font-semibold text-ink hover:bg-line">Chat record</button>
      <Modal open={open} onClose={() => setOpen(false)} maxWidth="max-w-lg" labelledBy={titleId}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lead font-extrabold tracking-tight">Chat record</h2>
            <p className="mt-1 text-label text-muted">
              Kept for safety only. Open it to look into an incident or a complaint on this ride; each view is logged.
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-surface-2"><X size={18} /></button>
        </div>
        <div className="mt-5">
          {error ? (
            <p role="alert" className="text-label text-danger">{error}</p>
          ) : messages === null ? (
            <p className="flex items-center gap-2 text-label text-muted"><Loader2 size={16} className="animate-spin" /> Loading...</p>
          ) : messages.length === 0 ? (
            <p className="text-label text-muted">Nothing was sent in the chat on this ride.</p>
          ) : (
            <ol className="space-y-3">
              {messages.map((message) => (
                <li key={message.id} className={`rounded-2xl px-4 py-3 ${message.from === 'driver' ? 'bg-brand-soft' : 'bg-surface-2'}`}>
                  <p className="text-caption font-bold text-muted">
                    {message.from === 'driver' ? 'Driver' : 'Parent'} · {when(message.sentAt)}{message.readAt ? ' · read' : ''}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-label text-ink">{message.body}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Modal>
    </>
  );
};
