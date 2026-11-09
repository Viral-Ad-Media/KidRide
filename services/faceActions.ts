import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import type { LivenessAction } from './driverChecks';

// On-device face tracking (MediaPipe Face Landmarker) for the liveness check:
// confirms one face is in view and that the driver really did each random action.
// Loaded only when a driver opens a face check. If it cannot load (old browser,
// blocked CDN) the check falls back to manual photos that an admin reviews.

const VERSION = '0.10.21';
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let loading: Promise<FaceLandmarker> | null = null;
export const loadFaceLandmarker = () => {
  loading ??= (async () => {
    const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const vision = await FilesetResolver.forVisionTasks(WASM);
    return FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 2,
      outputFaceBlendshapes: true
    });
  })().catch((error) => { loading = null; throw error; });
  return loading;
};

export interface FaceReading {
  faces: number;
  // 0.5 looking straight at the camera; lower or higher when turned (raw camera image, not mirrored).
  yaw: number;
  // Nose position between the eyes (0) and the chin (1); changes when nodding.
  pitch: number;
  jawOpen: number;
  blink: number;
  smile: number;
}

export const readFace = (result: FaceLandmarkerResult): FaceReading | null => {
  const faces = result.faceLandmarks.length;
  if (!faces) return { faces: 0, yaw: 0.5, pitch: 0.5, jawOpen: 0, blink: 0, smile: 0 };
  const points = result.faceLandmarks[0];
  const nose = points[1];
  const left = points[234];
  const right = points[454];
  const eyes = { y: (points[33].y + points[263].y) / 2 };
  const chin = points[152];
  const shape = Object.fromEntries((result.faceBlendshapes[0]?.categories || []).map((c) => [c.categoryName, c.score]));
  return {
    faces,
    yaw: (nose.x - left.x) / ((right.x - left.x) || 1),
    pitch: (nose.y - eyes.y) / ((chin.y - eyes.y) || 1),
    jawOpen: shape.jawOpen || 0,
    blink: Math.min(shape.eyeBlinkLeft || 0, shape.eyeBlinkRight || 0),
    smile: ((shape.mouthSmileLeft || 0) + (shape.mouthSmileRight || 0)) / 2
  };
};

/** Looking straight at the camera with a neutral face. */
export const isNeutral = (r: FaceReading) => r.faces === 1 && Math.abs(r.yaw - 0.5) < 0.12 && r.jawOpen < 0.2 && r.blink < 0.4;

/**
 * Whether the action is happening now. baseline is the neutral reading; a nod is
 * a clear pitch change from it. Turns are checked on the raw (unmirrored) image,
 * where turning to your left moves the nose toward the image's right.
 */
export const actionDone = (action: LivenessAction, r: FaceReading, baseline: FaceReading) => {
  if (r.faces !== 1) return false;
  switch (action) {
    case 'turn_left': return r.yaw > 0.7;
    case 'turn_right': return r.yaw < 0.3;
    case 'open_mouth': return r.jawOpen > 0.45;
    case 'nod': return Math.abs(r.pitch - baseline.pitch) > 0.12;
    case 'blink': return r.blink > 0.55;
    case 'smile': return r.smile > 0.55;
    default: return false;
  }
};
