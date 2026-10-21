import React, { useState } from 'react';
import { X } from 'lucide-react';

// A Marigold sticky note pinned to the page, for a short reminder. It hangs
// slightly off square, swings once when it appears, lifts on hover, and can
// be taken down (remembered per browser under `id`).

interface StickyNoteProps {
  id: string;
  title: string;
  lines: string[];
  className?: string;
}

const dismissed = (id: string) => { try { return window.localStorage.getItem(`kidride.note.${id}`) === 'gone'; } catch { return false; } };

export const StickyNote: React.FC<StickyNoteProps> = ({ id, title, lines, className = '' }) => {
  const [gone, setGone] = useState(() => dismissed(id));
  if (gone) return null;
  const remove = () => { setGone(true); try { window.localStorage.setItem(`kidride.note.${id}`, 'gone'); } catch { /* shown again next time */ } };
  return (
    <aside className={`kr-note relative w-[232px] ${className}`} aria-label={title}>
      {/* Pin */}
      <span className="kr-note-pin absolute -top-3 left-1/2 z-10 -ml-3 h-6 w-6" aria-hidden="true">
        <span className="absolute left-1/2 top-3 h-4 w-[3px] -translate-x-1/2 rounded-full bg-[#8A94A6]" />
        <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#ff8a8a_0%,#d7263d_55%,#9b1324_100%)] shadow-[0_3px_6px_rgba(20,33,61,0.35)]" />
      </span>
      <div className="kr-note-paper relative rounded-[3px] bg-[linear-gradient(170deg,#FFE28A_0%,#FFD14D_60%,#F8C53B_100%)] px-4 pb-4 pt-5 text-ink shadow-[0_10px_18px_rgba(20,33,61,0.18),0_2px_3px_rgba(20,33,61,0.12)]">
        <button type="button" onClick={remove} className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-ink/60 hover:bg-ink/10 hover:text-ink" aria-label="Take the note down"><X size={14} /></button>
        <p className="text-[15px] font-extrabold leading-tight">{title}</p>
        <ul className="mt-2 space-y-1.5 text-[13px] leading-snug text-ink/85">
          {lines.map((line) => <li key={line} className="flex gap-1.5"><span aria-hidden="true">•</span><span>{line}</span></li>)}
        </ul>
        <span className="pointer-events-none absolute bottom-0 right-0 h-7 w-7 rounded-tl-[3px] bg-[linear-gradient(315deg,#F6F9FC_0%,#F6F9FC_48%,#e3b531_50%,#f3c43e_100%)] shadow-[-2px_-2px_4px_rgba(20,33,61,0.08)]" aria-hidden="true" />
      </div>
    </aside>
  );
};
