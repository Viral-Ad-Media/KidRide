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

/** Top-down car in a soft halo; rotate it with marker.setRotation(heading). */
export const carHtml = (color = BRAND.blue, rotation = 0) => `
  <div style="position:relative;width:46px;height:46px;display:flex;align-items:center;justify-content:center">
    <span style="position:absolute;inset:0;border-radius:9999px;background:${color}22;border:1px solid ${color}33"></span>
    <div data-rotate style="transform:rotate(${rotation}deg);transition:none;filter:drop-shadow(0 4px 5px rgba(15,23,42,.35));line-height:0">
      <svg width="22" height="36" viewBox="0 0 22 36" aria-hidden="true">
        <rect x="1.5" y="1.5" width="19" height="33" rx="8" fill="${color}" stroke="#fff" stroke-width="2.5"/>
        <path d="M5 11.5c3.6-2.6 8.4-2.6 12 0v4.5H5z" fill="#e0ecff"/>
        <rect x="5" y="24" width="12" height="5" rx="2.5" fill="#e0ecff" opacity=".85"/>
        <rect x="9" y="3.5" width="4" height="3" rx="1.5" fill="#fff" opacity=".9"/>
      </svg>
    </div>
  </div>`;

/** Teardrop pin with a dark label chip above it ("Pickup · Mia", "Drop-off"). */
export const stopPinHtml = (label: string, color: string, glyph: 'pickup' | 'dropoff') => `
  <div style="display:flex;flex-direction:column;align-items:center">
    <div style="margin-bottom:4px;white-space:nowrap;border-radius:9999px;background:${BRAND.ink};color:#fff;font:600 11px/1 ${BRAND.font};padding:6px 10px;box-shadow:0 6px 14px rgba(15,23,42,.25)">${escapeHtml(label)}</div>
    <svg width="30" height="38" viewBox="0 0 30 38" aria-hidden="true" style="filter:drop-shadow(0 4px 4px rgba(15,23,42,.25))">
      <path d="M15 36.5S27.5 23.6 27.5 14.6a12.5 12.5 0 1 0-25 0C2.5 23.6 15 36.5 15 36.5z" fill="${color}" stroke="#fff" stroke-width="2.5"/>
      ${glyph === 'pickup'
        ? '<circle cx="15" cy="14.5" r="5" fill="#fff"/>'
        : '<path d="M11 9.5v10M11 10h8.5l-2 3 2 3H11" stroke="#fff" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>'}
    </svg>
  </div>`;

/** Amber dot with a pulse, for rides waiting for a driver. */
export const waitingPinHtml = (selected = false) => `
  <div style="position:relative;width:26px;height:26px">
    <span class="animate-ping" style="position:absolute;inset:0;border-radius:9999px;background:rgba(245,158,11,.45)"></span>
    <span style="position:absolute;inset:3px;border-radius:9999px;background:${BRAND.amber};border:3px solid ${selected ? BRAND.ink : '#fff'};box-shadow:0 3px 8px rgba(15,23,42,.3)"></span>
  </div>`;

/** Small dot for secondary stops (e.g. admin drop-offs). */
export const dotHtml = (color: string, letter = '') => `
  <div style="width:20px;height:20px;border-radius:9999px;background:${color};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(15,23,42,.3);color:#fff;font:700 10px/15px ${BRAND.font};text-align:center">${escapeHtml(letter)}</div>`;
