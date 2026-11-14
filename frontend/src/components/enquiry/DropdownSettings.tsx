import React, { useEffect, useState } from 'react';
import { Plus, Eye, EyeOff } from 'lucide-react';
import { Button, LoadingState, notify } from '../ui';
import { DropdownOption, errorText, followupApi } from './enquiryApi';

const LISTS: { kind: DropdownOption['kind']; title: string; hint: string; placeholder: string }[] = [
  { kind: 'CALL_RESULT', title: 'Extra call results (call again)', hint: 'Shown with the call results. Each one asks when to call again.', placeholder: 'e.g. Wants to see the bus route' },
  { kind: 'REJECT_REASON', title: 'Reasons for "Not interested"', hint: 'Callers tap one of these. "Other" is always there too.', placeholder: 'e.g. Looking for CBSE board' },
  { kind: 'BENEFIT', title: 'Common scheme benefits', hint: 'Pick these when setting up a scheme instead of typing.', placeholder: 'e.g. Free school bag' },
];

/** Admin settings: the dropdown lists used by callers and in schemes. */
const DropdownSettings: React.FC<{ branchId: number; onChanged?: () => void }> = ({ branchId, onChanged }) => {
  const [items, setItems] = useState<DropdownOption[] | null>(null);
  const [text, setText] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = () => followupApi.dropdowns(branchId, true)
    .then(d => setItems([...(d.call_results || []), ...d.reject_reasons, ...d.benefits]))
    .catch(err => { setItems([]); notify.error(errorText(err)); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [branchId]);

  const add = async (kind: DropdownOption['kind']) => {
    const label = (text[kind] || '').trim();
    if (label.length < 2 || busy) return;
    setBusy(true);
    try {
      notify.success((await followupApi.addDropdown(branchId, kind, label)).message);
      setText(t => ({ ...t, [kind]: '' }));
      await load(); onChanged?.();
    } catch (err) { notify.error(errorText(err)); } finally { setBusy(false); }
  };

  const toggle = async (o: DropdownOption) => {
    try {
      await followupApi.updateDropdown(branchId, o.id, { is_active: !o.is_active });
      await load(); onChanged?.();
    } catch (err) { notify.error(errorText(err)); }
  };

  return (
    <section className="card p-4 sm:p-6 space-y-5" aria-label="Dropdown settings">
      <div>
        <h2 className="font-semibold text-slate-900">Settings: dropdown lists</h2>
        <p className="text-sm text-slate-500">Keep these short and clear. Switched-off items stay in old records but are no longer offered.</p>
      </div>
      {!items ? <LoadingState className="py-6" /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5">
          {LISTS.map(list => {
            const rows = items.filter(i => i.kind === list.kind);
            return (
              <div key={list.kind}>
                <h3 className="text-sm font-semibold text-slate-800">{list.title}</h3>
                <p className="text-xs text-slate-500 mb-2">{list.hint}</p>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {rows.map(o => (
                    <li key={o.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                      <span className={`text-sm ${o.is_active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{o.label}</span>
                      <button type="button" onClick={() => toggle(o)} className="btn-ghost btn-sm min-h-[40px]"
                        aria-label={o.is_active ? `Switch off ${o.label}` : `Switch on ${o.label}`}>
                        {o.is_active ? <><EyeOff className="w-4 h-4" /> Switch off</> : <><Eye className="w-4 h-4" /> Switch on</>}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2">
                  <input className="input" maxLength={150} value={text[list.kind] || ''} placeholder={list.placeholder}
                    aria-label={`Add to ${list.title}`}
                    onChange={e => setText(t => ({ ...t, [list.kind]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') add(list.kind); }} />
                  <Button variant="secondary" icon={<Plus className="w-4 h-4" />} disabled={busy || (text[list.kind] || '').trim().length < 2}
                    onClick={() => add(list.kind)}>Add</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default DropdownSettings;
