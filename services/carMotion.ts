import type { HtmlMarker } from '../components/mapMarkers';
import type { LatLng } from './googleMaps';

// Smooth car movement for the maps, the way Uber/Bolt cars move:
// - Glide: each GPS fix is reached over the time that passed between the last
//   two fixes, so the car keeps rolling until the next one arrives instead of
//   stopping and starting every few seconds.
// - Route snap: when a fix is close to a known route, the car sits on the road
//   and follows the road's curves between fixes rather than cutting corners.
// - Road heading: the car faces along the road (or along its movement off a
//   route), and turns smoothly instead of snapping round.

const MIN_GLIDE_MS = 800;
const MAX_GLIDE_MS = 6000;
const DEFAULT_GLIDE_MS = 3000;
const SNAP_METERS = 35;
const TELEPORT_METERS = 1500;
const TURN_MS = 220; // time constant for easing the car round to its heading

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Metres between two points (equirectangular; plenty for city distances). */
export const distanceMeters = (a: LatLng, b: LatLng) => {
  const x = toRad(b.lng - a.lng) * Math.cos(toRad((a.lat + b.lat) / 2));
  const y = toRad(b.lat - a.lat);
  return Math.sqrt(x * x + y * y) * 6371000;
};

/** Compass bearing from a to b, 0 = north, clockwise. */
export const bearing = (a: LatLng, b: LatLng) => {
  const x = toRad(b.lng - a.lng) * Math.cos(toRad((a.lat + b.lat) / 2));
  const y = toRad(b.lat - a.lat);
  return (toDeg(Math.atan2(x, y)) + 360) % 360;
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// Turn the short way round (e.g. 350 deg -> 10 deg goes through 0, not back through 180).
export const lerpAngle = (a: number, b: number, t: number) => a + ((((b - a) % 360) + 540) % 360 - 180) * t;
const lerpPoint = (a: LatLng, b: LatLng, t: number): LatLng => ({ lat: lerp(a.lat, b.lat, t), lng: lerp(a.lng, b.lng, t) });

interface Track { points: LatLng[]; along: number[] }
interface Snap { track: Track; along: number; point: LatLng; offset: number }

const buildTrack = (points: LatLng[]): Track => {
  const along = [0];
  for (let i = 1; i < points.length; i++) along.push(along[i - 1] + distanceMeters(points[i - 1], points[i]));
  return { points, along };
};

/** Nearest point on a track to p, with how far along the track it is. */
const snapTo = (track: Track, p: LatLng): Snap | null => {
  let best: Snap | null = null;
  for (let i = 1; i < track.points.length; i++) {
    const a = track.points[i - 1];
    const b = track.points[i];
    const length = track.along[i] - track.along[i - 1];
    // Project in local metres around a.
    const kx = Math.cos(toRad(a.lat)) * 111320;
    const ky = 110540;
    const bx = (b.lng - a.lng) * kx; const by = (b.lat - a.lat) * ky;
    const px = (p.lng - a.lng) * kx; const py = (p.lat - a.lat) * ky;
    const t = length > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / (bx * bx + by * by))) : 0;
    const point = lerpPoint(a, b, t);
    const offset = distanceMeters(point, p);
    if (!best || offset < best.offset) best = { track, along: track.along[i - 1] + length * t, point, offset };
  }
  return best;
};

/** Point and road direction at a distance along a track. */
const pointAt = (track: Track, along: number): { point: LatLng; heading: number } => {
  const { points, along: cum } = track;
  let i = 1;
  while (i < points.length - 1 && cum[i] < along) i++;
  const a = points[i - 1];
  const b = points[i];
  const length = cum[i] - cum[i - 1];
  const t = length > 0 ? Math.max(0, Math.min(1, (along - cum[i - 1]) / length)) : 0;
  return { point: lerpPoint(a, b, t), heading: bearing(a, b) };
};

export interface CarFix {
  position: LatLng;
  /** Phone compass heading, if it sent one. */
  heading?: number | null;
  /** When the fix was taken (ms since epoch). */
  recordedAt?: number;
}

type Leg =
  | { kind: 'road'; track: Track; from: number; to: number }
  | { kind: 'straight'; from: LatLng; to: LatLng; heading: number };

export class CarMotion {
  private tracks: Track[] = [];
  private position: LatLng | null = null;
  private rotation = 0;
  private targetRotation = 0;
  private leg: Leg | null = null;
  private legStart = 0;
  private legMs = DEFAULT_GLIDE_MS;
  private lastRecordedAt: number | null = null;
  private lastFrame = 0;
  private frame: number | null = null;
  private readonly reducedMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  constructor(private readonly marker: HtmlMarker) {}

  /** Roads the car is expected to be on (e.g. the approach to pickup and the trip route). */
  setRoutes(paths: LatLng[][]) {
    this.tracks = paths.filter((path) => path.length > 1).map(buildTrack);
  }

  getPosition() { return this.position; }
  getRotation() { return this.rotation; }

  update(fix: CarFix) {
    const snap = this.snap(fix.position);
    const target = snap ? snap.point : fix.position;
    const now = performance.now();

    // First fix, a long jump (GPS reset, new shift) or reduced motion: place it there.
    if (!this.position || distanceMeters(this.position, target) > TELEPORT_METERS || this.reducedMotion) {
      this.position = target;
      this.rotation = this.targetRotation = snap ? pointAt(snap.track, snap.along).heading : fix.heading ?? this.rotation;
      this.leg = null;
      this.lastRecordedAt = fix.recordedAt ?? null;
      this.render();
      return;
    }

    // Reach this fix over the same time the last gap took, so the car is still
    // moving when the next fix arrives.
    const gap = fix.recordedAt && this.lastRecordedAt ? fix.recordedAt - this.lastRecordedAt : NaN;
    this.legMs = Number.isFinite(gap) && gap > 0 ? Math.min(MAX_GLIDE_MS, Math.max(MIN_GLIDE_MS, gap)) : DEFAULT_GLIDE_MS;
    if (fix.recordedAt) this.lastRecordedAt = fix.recordedAt;

    const from = this.position;
    const fromSnap = snap ? snapTo(snap.track, from) : null;
    const straight = distanceMeters(from, target);
    // Follow the road only forwards and only when that is a sensible detour.
    if (snap && fromSnap && fromSnap.offset < SNAP_METERS && snap.along >= fromSnap.along && snap.along - fromSnap.along < straight * 2.5 + 40) {
      this.leg = { kind: 'road', track: snap.track, from: fromSnap.along, to: snap.along };
    } else {
      const moved = straight > 3;
      const heading = moved ? bearing(from, target) : fix.heading ?? this.targetRotation;
      this.leg = { kind: 'straight', from, to: target, heading };
    }
    this.legStart = now;
    this.start();
  }

  stop() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  private snap(p: LatLng): Snap | null {
    let best: Snap | null = null;
    for (const track of this.tracks) {
      const snap = snapTo(track, p);
      if (snap && snap.offset <= SNAP_METERS && (!best || snap.offset < best.offset)) best = snap;
    }
    return best;
  }

  private start() {
    if (this.frame !== null) return;
    this.lastFrame = performance.now();
    const step = (time: number) => {
      this.frame = null;
      const dt = Math.max(0, time - this.lastFrame);
      this.lastFrame = time;
      const leg = this.leg;
      if (leg) {
        const t = Math.min(1, (time - this.legStart) / this.legMs);
        if (leg.kind === 'road') {
          const at = pointAt(leg.track, lerp(leg.from, leg.to, t));
          this.position = at.point;
          if (leg.to > leg.from) this.targetRotation = at.heading;
        } else {
          this.position = lerpPoint(leg.from, leg.to, t);
          this.targetRotation = leg.heading;
        }
        if (t >= 1) this.leg = null;
      }
      // Ease round towards the heading, frame-rate independent.
      this.rotation = lerpAngle(this.rotation, this.targetRotation, 1 - Math.exp(-dt / TURN_MS));
      this.render();
      const turning = Math.abs(((((this.targetRotation - this.rotation) % 360) + 540) % 360) - 180) > 0.5;
      if (this.leg || turning) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  private render() {
    if (!this.position) return;
    this.marker.setPosition(this.position);
    this.marker.setRotation(this.rotation);
  }
}
