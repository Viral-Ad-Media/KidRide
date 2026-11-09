import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '../UIComponents';
import { ACTION_PROMPTS, LivenessAction, grabFrame, startCheck, submitCheck, uploadCheckPhoto } from '../../services/driverChecks';
import { FaceReading, actionDone, isNeutral, loadFaceLandmarker, readFace } from '../../services/faceActions';

// Face check: a neutral photo, then three random actions (turn, open mouth,
// nod, blink, smile) confirmed on the device. Each moment is photographed and
// sent for review. If an action is not recognised within 15 s the driver can
// take the photo by hand; the check is then marked for a closer admin look.

type Step = 'neutral' | LivenessAction;
const MANUAL_AFTER_MS = 15000;
const HOLD_FRAMES = 6;

export const LivenessCheck: React.FC<{ checkId: string; onDone: () => void; onCancel: () => void }> = ({ checkId, onDone, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [index, setIndex] = useState(0);
  const [detector, setDetector] = useState<'loading' | 'ready' | 'off'>('loading');
  const [faceHint, setFaceHint] = useState<string | null>(null);
  const [manualReady, setManualReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploads = useRef<Record<string, Promise<string>>>({});
  const manualUsed = useRef(false);
  const baseline = useRef<FaceReading | null>(null);

  // Challenge + camera + detector.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        const challenge = await startCheck(checkId);
        if (cancelled) return;
        setSteps(['neutral', ...(challenge.actions || [])]);
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => undefined); }
      } catch (err) {
        setError(err instanceof DOMException ? 'Allow camera access to do the face check.' : err instanceof Error ? err.message : 'Could not start the face check.');
      }
    })();
    loadFaceLandmarker().then(() => !cancelled && setDetector('ready')).catch(() => !cancelled && setDetector('off'));
    return () => { cancelled = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [checkId]);

  const step = steps?.[index];

  const capture = async (manual: boolean) => {
    const video = videoRef.current;
    if (!video || !step || !video.videoWidth) return;
    if (manual) manualUsed.current = true;
    const blob = await grabFrame(video);
    uploads.current[step] = uploadCheckPhoto(checkId, step, blob);
    uploads.current[step].catch(() => undefined);
    setManualReady(false);
    setIndex((i) => i + 1);
  };

  // Watch the face for the current step.
  useEffect(() => {
    if (!step || detector !== 'ready') return undefined;
    let frame = 0;
    let held = 0;
    let stopped = false;
    let landmarker: Awaited<ReturnType<typeof loadFaceLandmarker>> | null = null;
    void loadFaceLandmarker().then((l) => { landmarker = l; });
    const loop = () => {
      if (stopped) return;
      const video = videoRef.current;
      if (landmarker && video && video.readyState >= 2) {
        const reading = readFace(landmarker.detectForVideo(video, performance.now()));
        if (reading) {
          setFaceHint(reading.faces === 0 ? 'Move into the frame' : reading.faces > 1 ? 'Only you should be in the frame' : null);
          const ok = step === 'neutral' ? isNeutral(reading) : actionDone(step, reading, baseline.current || reading);
          held = ok ? held + 1 : 0;
          if (held >= (step === 'neutral' ? HOLD_FRAMES : 2)) {
            if (step === 'neutral') baseline.current = reading;
            stopped = true;
            void capture(false);
            return;
          }
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => { stopped = true; cancelAnimationFrame(frame); };
  }, [step, detector]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual photo button after a while, or straight away without the detector.
  useEffect(() => {
    if (!step) return undefined;
    if (detector === 'off') { setManualReady(true); return undefined; }
    const timer = setTimeout(() => setManualReady(true), MANUAL_AFTER_MS);
    return () => clearTimeout(timer);
  }, [step, detector]);

  // All steps done: send.
  useEffect(() => {
    if (!steps || index < steps.length || sending) return;
    setSending(true);
    (async () => {
      try {
        const files: Record<string, string> = {};
        for (const s of steps) files[s] = await uploads.current[s];
        await submitCheck(checkId, { files, method: manualUsed.current || detector !== 'ready' ? 'manual' : 'detected' });
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not send the face check.');
        setSending(false);
      }
    })();
  }, [index, steps]); // eslint-disable-line react-hooks/exhaustive-deps

  const prompt = !step ? '' : step === 'neutral' ? 'Look straight at the camera' : ACTION_PROMPTS[step];

  return (
    <div className="space-y-4">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-card bg-ink">
        <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        <div className="pointer-events-none absolute inset-[12%] rounded-[50%] border-4 border-white/80" />
        {steps && index < steps.length && (
          <div className="absolute inset-x-0 bottom-0 bg-ink/70 px-4 py-3 text-center text-white">
            <p className="text-title font-bold">{prompt}</p>
            {faceHint && <p className="mt-1 text-label text-brand">{faceHint}</p>}
          </div>
        )}
        {(sending || !steps) && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/60 text-white"><Loader2 className="animate-spin" size={32} /></div>
        )}
      </div>
      {steps && (
        <ol className="flex justify-center gap-2" aria-label="Progress">
          {steps.map((s, i) => (
            <li key={s} className={`flex h-8 w-8 items-center justify-center rounded-full text-caption font-bold ${i < index ? 'bg-success text-white' : i === index ? 'bg-brand text-ink' : 'bg-surface-2 text-muted'}`}>
              {i < index ? <CheckCircle2 size={16} /> : i + 1}
            </li>
          ))}
        </ol>
      )}
      {detector === 'loading' && steps && <p className="text-center text-caption text-muted">Starting face tracking...</p>}
      {detector === 'off' && <p className="text-center text-caption text-muted">Face tracking is not available on this device. Take each photo yourself while doing the prompt.</p>}
      {error && <p role="alert" className="text-center text-label text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={sending}>Cancel</Button>
        {manualReady && steps && index < steps.length && (
          <Button onClick={() => void capture(true)} className="flex-1"><Camera size={18} className="mr-2 inline" />Take photo</Button>
        )}
      </div>
    </div>
  );
};
