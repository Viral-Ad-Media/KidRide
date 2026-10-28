import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// A Marigold sticky note floating above the page, for a short reminder. It
// starts top-right, takes no layout space, can be dragged anywhere on screen
// (position remembered per browser under `id`), swings once when it appears,
// and can be taken down (also remembered).

interface StickyNoteProps {
  id: string;
  title: string;
  lines: string[];
  className?: string;
}

type Pos = { x: number; y: number };

const WIDTH = 232;
const MARGIN = 12;
const DEFAULT_TOP = 88;

const key = (id: string, what: string) => `kidride.note.${id}${what}`;
const read = (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* not remembered */ } };

const clamp = (p: Pos, h: number): Pos => ({
  x: Math.min(Math.max(MARGIN, p.x), window.innerWidth - WIDTH - MARGIN),
  y: Math.min(Math.max(MARGIN, p.y), window.innerHeight - Math.min(h, 80) - MARGIN),
});

const initialPos = (id: string): Pos => {
  try {
    const saved = JSON.parse(read(key(id, '.pos')) || 'null');
    if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') return clamp(saved, 0);
  } catch { /* fall through to default */ }
  return { x: window.innerWidth - WIDTH - 24, y: DEFAULT_TOP };
};

export const StickyNote: React.FC<StickyNoteProps> = ({ id, title, lines, className = '' }) => {
  const [gone, setGone] = useState(() => read(key(id, '')) === 'gone');
  const [pos, setPos] = useState<Pos>(() => initialPos(id));
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const grab = useRef<Pos>({ x: 0, y: 0 });

  // Keep the note on screen when the window shrinks.
  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p, ref.current?.offsetHeight || 0));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (gone) return null;

  const remove = () => { setGone(true); write(key(id, ''), 'gone'); };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    grab.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setPos(clamp({ x: e.clientX - grab.current.x, y: e.clientY - grab.current.y }, ref.current?.offsetHeight || 0));
  };
  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    write(key(id, '.pos'), JSON.stringify(pos));
  };

  return createPortal(
    <aside
      ref={ref}
      className={`kr-note fixed z-[190] hidden md:block ${dragging ? 'kr-note--drag cursor-grabbing' : 'cursor-grab'} ${className}`}
      style={{ left: pos.x, top: pos.y, width: WIDTH, touchAction: 'none' }}
      aria-label={title}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Pin */}
      <span className="kr-note-pin absolute -top-3 left-1/2 z-10 -ml-3 h-6 w-6" aria-hidden="true">
        <span className="absolute left-1/2 top-3 h-4 w-[3px] -translate-x-1/2 rounded-full bg-[#8A94A6]" />
        <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#ff8a8a_0%,#d7263d_55%,#9b1324_100%)] shadow-[0_3px_6px_rgba(20,33,61,0.35)]" />
      </span>
      <div className="kr-note-paper relative select-none rounded-[3px] bg-[linear-gradient(170deg,#FFE28A_0%,#FFD14D_60%,#F8C53B_100%)] px-4 pb-4 pt-5 text-ink shadow-[0_10px_18px_rgba(20,33,61,0.18),0_2px_3px_rgba(20,33,61,0.12)]">
        <button type="button" onClick={remove} className="absolute right-1.5 top-1.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-ink/60 hover:bg-ink/10 hover:text-ink" aria-label="Take the note down"><X size={14} /></button>
        <p className="pr-6 text-[15px] font-extrabold leading-tight">{title}</p>
        <ul className="mt-2 space-y-1.5 text-[13px] leading-snug text-ink/85">
          {lines.map((line) => <li key={line} className="flex gap-1.5"><span aria-hidden="true">•</span><span>{line}</span></li>)}
        </ul>
        <span className="pointer-events-none absolute bottom-0 right-0 h-7 w-7 rounded-tl-[3px] bg-[linear-gradient(315deg,#F6F9FC_0%,#F6F9FC_48%,#e3b531_50%,#f3c43e_100%)] shadow-[-2px_-2px_4px_rgba(20,33,61,0.08)]" aria-hidden="true" />
      </div>
    </aside>,
    document.body,
  );
};
