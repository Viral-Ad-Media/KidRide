import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, MapPin, RotateCcw } from 'lucide-react';
import { Button } from '../UIComponents';
import { CHECK_HELP, CheckKind, DOCUMENT_KINDS, currentPosition, grabFrame, startCheck, submitCheck, uploadCheckPhoto } from '../../services/driverChecks';

// Live photo check (car, plate, licence or current location). The camera is the
// only source, so a saved or old picture cannot be used, and the device's GPS
// position is sent with it.

export const PhotoCheck: React.FC<{ checkId: string; kind: CheckKind; onDone: () => void; onCancel: () => void }> = ({ checkId, kind, onDone, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresOn, setExpiresOn] = useState('');
  const needsExpiry = DOCUMENT_KINDS.includes(kind);
  const today = new Date().toISOString().slice(0, 10);
  const facing = 'environment';

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        await startCheck(checkId);
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => undefined); }
        setReady(true);
      } catch (err) {
        setError(err instanceof DOMException ? 'Allow camera access to take the photo.' : err instanceof Error ? err.message : 'Could not start the camera.');
      }
    })();
    return () => { cancelled = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [checkId, facing]);

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  const take = async () => {
    if (!videoRef.current) return;
    const blob = await grabFrame(videoRef.current);
    setPhoto({ blob, url: URL.createObjectURL(blob) });
  };

  const send = async () => {
    if (!photo) return;
    setSending(true);
    setError(null);
    try {
      const fix = await currentPosition();
      if (needsExpiry && !(expiresOn > today)) throw new Error('Enter the expiry date shown on the document.');
      if (kind === 'location_photo' && !fix) throw new Error('Allow location access so we can record where the photo was taken.');
      const path = await uploadCheckPhoto(checkId, 'photo', photo.blob);
      await submitCheck(checkId, { files: { photo: path }, position: fix ? { latitude: fix.coords.latitude, longitude: fix.coords.longitude, accuracy: fix.coords.accuracy } : null, ...(needsExpiry ? { expiresOn } : {}) });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the photo.');
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-label text-muted">{CHECK_HELP[kind]}</p>
      <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-card bg-ink">
        <video ref={videoRef} playsInline muted className={`h-full w-full object-cover ${photo ? 'hidden' : ''}`} />
        {photo && <img src={photo.url} alt="Your photo" className="h-full w-full object-cover" />}
        {!ready && !error && <div className="absolute inset-0 flex items-center justify-center text-white"><Loader2 className="animate-spin" size={32} /></div>}
      </div>
      {needsExpiry && (
        <label className="block text-label font-semibold">Expiry date on the document
          <input type="date" min={today} value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className="mt-1 h-11 w-full rounded-control border border-line px-3 font-normal" />
        </label>
      )}
      {kind === 'location_photo' && <p className="flex items-center gap-2 text-caption text-muted"><MapPin size={14} />Your GPS position is sent with this photo.</p>}
      {error && <p role="alert" className="text-label text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={sending}>Cancel</Button>
        {photo ? (
          <>
            <Button variant="secondary" onClick={() => setPhoto(null)} disabled={sending}><RotateCcw size={18} className="mr-2 inline" />Retake</Button>
            <Button onClick={() => void send()} disabled={sending} className="flex-1">{sending ? 'Sending...' : 'Send photo'}</Button>
          </>
        ) : (
          <Button onClick={() => void take()} disabled={!ready} className="flex-1"><Camera size={18} className="mr-2 inline" />Take photo</Button>
        )}
      </div>
    </div>
  );
};
