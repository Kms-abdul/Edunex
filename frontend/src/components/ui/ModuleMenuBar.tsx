import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface ModuleMenuItem {
  id: string;
  label: string;
  hint?: string;
  active?: boolean;
  onSelect: () => void;
}

export interface ModuleMenu {
  id: string;
  label: string;
  items: ModuleMenuItem[];
}

/**
 * Module header with one dropdown button per menu group (e.g. Enter Marks / Masters / Reports).
 * Callers pass only the items the user is allowed to open; empty menus are hidden,
 * so access can be given screen by screen through roles.
 */
const ModuleMenuBar: React.FC<{
  title: string;
  icon?: React.ReactNode;
  menus: ModuleMenu[];
}> = ({ title, icon, menus }) => {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const visible = menus.filter(m => m.items.length > 0);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="no-print bg-white border-b border-slate-200 z-20">
      <div ref={ref} className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3">
        <h1 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-slate-900 tracking-tight uppercase">
          {icon && <span className="text-brand-600">{icon}</span>}
          {title}
        </h1>
        {visible.length > 0 && (
          <nav aria-label={`${title} menu`} className="flex flex-wrap items-center gap-2">
            {visible.map((m, idx) => {
              const isOpen = open === m.id;
              const hasActive = m.items.some(i => i.active);
              const alignRight = idx >= visible.length - 2;
              return (
                <div key={m.id} className="relative">
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : m.id)}
                    className={`inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-lg border text-sm font-semibold transition-colors
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
                      ${isOpen || hasActive
                        ? 'bg-brand-100 border-brand-300 text-brand-800'
                        : 'bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100'}`}
                  >
                    {m.label}
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div
                      role="menu"
                      className={`absolute top-full mt-1.5 z-40 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg animate-fade-in
                        ${alignRight ? 'right-0' : 'left-0'}`}
                    >
                      {m.items.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          role="menuitem"
                          onClick={() => { setOpen(null); item.onSelect(); }}
                          className={`w-full flex items-start gap-2 px-3.5 py-2.5 text-left hover:bg-slate-50 focus:outline-none focus-visible:bg-brand-50
                            ${item.active ? 'bg-brand-50' : ''}`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className={`block text-sm ${item.active ? 'font-semibold text-brand-800' : 'font-medium text-slate-800'}`}>{item.label}</span>
                            {item.hint && <span className="block text-xs text-slate-500 mt-0.5">{item.hint}</span>}
                          </span>
                          {item.active && <Check className="w-4 h-4 mt-0.5 text-brand-600 flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
};

export default ModuleMenuBar;
