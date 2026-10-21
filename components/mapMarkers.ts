/// <reference types="google.maps" />
import { LatLng } from '../services/googleMaps';
import { BRAND } from '../services/mapStyle';

// KidRide's own map markers, drawn as HTML on top of the map (a Google
// OverlayView) so they can use our SVGs, shadows, label chips and CSS
// animation. The car turns by rotating its inner [data-rotate] element.

export interface HtmlMarker {
  readonly element: HTMLDivElement;
  setPosition: (position: LatLng) => void;
  getPosition: () => LatLng;
  setRotation: (degrees: number) => void;
  setHtml: (html: string) => void;
  setZIndex: (zIndex: number) => void;
  remove: () => void;
}

interface HtmlMarkerOptions {
  map: google.maps.Map;
  position: LatLng;
  html: string;
  /** 'center' for cars and dots, 'bottom' for pins that point at the spot. */
  anchor?: 'center' | 'bottom';
  title?: string;
  zIndex?: number;
  onClick?: () => void;
}

type MarkerConstructor = new (options: HtmlMarkerOptions) => HtmlMarker;
let MarkerClass: MarkerConstructor | null = null;

const markerClass = (maps: typeof google.maps): MarkerConstructor => {
  if (MarkerClass) return MarkerClass;
  class KidRideMarker extends maps.OverlayView implements HtmlMarker {
    readonly element: HTMLDivElement;
    private position: LatLng;
    constructor({ map, position, html, anchor = 'center', title, zIndex = 1, onClick }: HtmlMarkerOptions) {
      super();
      this.position = position;
      this.element = document.createElement('div');
      Object.assign(this.element.style, { position: 'absolute', transform: anchor === 'bottom' ? 'translate(-50%, -100%)' : 'translate(-50%, -50%)', zIndex: String(zIndex), fontFamily: BRAND.font });
      this.element.innerHTML = html;
      if (title) { this.element.title = title; this.element.setAttribute('aria-label', title); }
      if (onClick) {
        this.element.style.cursor = 'pointer';
        this.element.setAttribute('role', 'button');
        this.element.addEventListener('click', (event) => { event.stopPropagation(); onClick(); });
      }
      this.setMap(map);
    }
    onAdd() { this.getPanes()?.overlayMouseTarget.appendChild(this.element); }
    draw() {
      const point = this.getProjection()?.fromLatLngToDivPixel(new maps.LatLng(this.position.lat, this.position.lng));
      if (!point) return;
      this.element.style.left = `${point.x}px`;
      this.element.style.top = `${point.y}px`;
    }
    onRemove() { this.element.remove(); }
    setPosition(position: LatLng) { this.position = position; this.draw(); }
    getPosition() { return this.position; }
    setRotation(degrees: number) { const inner = this.element.querySelector<HTMLElement>('[data-rotate]'); if (inner) inner.style.transform = `rotate(${degrees}deg)`; }
    setHtml(html: string) { this.element.innerHTML = html; }
    setZIndex(zIndex: number) { this.element.style.zIndex = String(zIndex); }
    remove() { this.setMap(null); }
  }
  MarkerClass = KidRideMarker;
  return MarkerClass;
};

export const createHtmlMarker = (maps: typeof google.maps, options: HtmlMarkerOptions): HtmlMarker => new (markerClass(maps))(options);

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** Top-down car: Sky body, Night Navy glass, one soft shadow. Rotate with marker.setRotation(heading). */
export const carHtml = (color = BRAND.sky, rotation = 0) => `
  <div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center">
    <div data-rotate style="transform:rotate(${rotation}deg);line-height:0;filter:drop-shadow(0 6px 8px rgba(20,33,61,.28))">
      <svg width="24" height="42" viewBox="0 0 24 42" aria-hidden="true">
        <rect x="0.5" y="9" width="3" height="5" rx="1.5" fill="${BRAND.ink}"/>
        <rect x="20.5" y="9" width="3" height="5" rx="1.5" fill="${BRAND.ink}"/>
        <rect x="2" y="1" width="20" height="40" rx="9" fill="${color}" stroke="#FFFFFF" stroke-width="1.6"/>
        <rect x="5" y="4" width="14" height="5" rx="2.5" fill="#FFFFFF" opacity=".35"/>
        <path d="M5.2 12.5c4.3-2.4 9.3-2.4 13.6 0l-1.4 6.2H6.6z" fill="${BRAND.ink}"/>
        <rect x="6.6" y="19.5" width="10.8" height="10" rx="3" fill="#FFFFFF" opacity=".28"/>
        <path d="M6.4 31h11.2l1.2 4.4c-4.2 1.8-9.4 1.8-13.6 0z" fill="${BRAND.ink}"/>
        <circle cx="6" cy="2.8" r="1.3" fill="#FFF3B0"/>
        <circle cx="18" cy="2.8" r="1.3" fill="#FFF3B0"/>
      </svg>
    </div>
  </div>`;

/** Teardrop pin with a label chip above it ("Pickup · Mia", "Drop-off"). */
export const stopPinHtml = (label: string, color: string, glyph: 'pickup' | 'dropoff') => `
  <div style="display:flex;flex-direction:column;align-items:center">
    <div style="margin-bottom:4px;white-space:nowrap;border-radius:9999px;background:${BRAND.ink};color:#fff;font:600 12px/1 ${BRAND.font};padding:6px 10px;box-shadow:0 8px 24px rgba(20,33,61,.12)">${escapeHtml(label)}</div>
    <svg width="30" height="38" viewBox="0 0 30 38" aria-hidden="true" style="filter:drop-shadow(0 3px 3px rgba(20,33,61,.22))">
      <path d="M15 36.5S27.5 23.6 27.5 14.6a12.5 12.5 0 1 0-25 0C2.5 23.6 15 36.5 15 36.5z" fill="${color}" stroke="#fff" stroke-width="2.5"/>
      ${glyph === 'pickup'
        ? `<circle cx="15" cy="14.5" r="5" fill="${BRAND.ink}"/>`
        : '<path d="M11 9.5v10M11 10h8.5l-2 3 2 3H11" stroke="#fff" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>'}
    </svg>
  </div>`;

/** Marigold dot with a pulse, for rides waiting for a driver. */
export const waitingPinHtml = (selected = false) => `
  <div style="position:relative;width:26px;height:26px">
    <span class="animate-ping" style="position:absolute;inset:0;border-radius:9999px;background:rgba(255,183,3,.45)"></span>
    <span style="position:absolute;inset:3px;border-radius:9999px;background:${BRAND.marigold};border:3px solid ${selected ? BRAND.ink : '#fff'};box-shadow:0 3px 8px rgba(20,33,61,.3)"></span>
  </div>`;

/** Small dot for secondary stops (e.g. admin drop-offs). */
export const dotHtml = (color: string, letter = '') => `
  <div style="width:20px;height:20px;border-radius:9999px;background:${color};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(20,33,61,.3);color:#fff;font:700 10px/15px ${BRAND.font};text-align:center">${escapeHtml(letter)}</div>`;
