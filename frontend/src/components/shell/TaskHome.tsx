import React, { useMemo, useState } from 'react';
import { ChevronRight, Search, X } from 'lucide-react';
import type { Page } from '../../App';
import { useAuth } from '../../contexts/AuthContext';
import SummaryBar from '../SummaryBar';
import { openWithIntent } from '../../utils/intent';
import { TASKS, GROUP_TITLES, canDo, Task } from './tasks';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const GROUP_ORDER: Task['group'][] = ['daily', 'students', 'fees', 'staff', 'school'];

/** One tappable row: what it does + one line explaining it. */
export const TaskRow: React.FC<{ task: Task; onOpen: (t: Task) => void; prominent?: boolean }> = ({ task, onOpen, prominent }) => (
  <button
    type="button"
    onClick={() => onOpen(task)}
    className={`group w-full flex items-center gap-3.5 text-left rounded-xl border bg-white px-4 transition-colors
      hover:border-brand-300 hover:bg-brand-50/40 focus-visible:ring-2 focus-visible:ring-brand-500
      ${prominent ? 'py-4 border-slate-200 shadow-card' : 'py-3.5 border-slate-200'}`}
  >
    <span className={`flex-shrink-0 flex items-center justify-center rounded-lg bg-brand-50 text-brand-600 ${prominent ? 'w-11 h-11' : 'w-10 h-10'}`}>
      {task.icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] font-semibold text-slate-900 leading-snug">{task.title}</span>
      <span className="block text-sm text-slate-500 leading-snug mt-0.5">{task.hint}</span>
    </span>
    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-brand-600 flex-shrink-0" />
  </button>
);

const TaskHome: React.FC<{ navigateTo: (page: Page) => void }> = ({ navigateTo }) => {
  const { user, hasPermission } = useAuth();
  const [query, setQuery] = useState('');

  const myTasks = useMemo(() => TASKS.filter(t => canDo(t, hasPermission)), [hasPermission]);
  const open = (t: Task) => openWithIntent(navigateTo, t.page, t.view);

  const q = query.trim().toLowerCase();
  const matches = q
    ? myTasks.filter(t => `${t.title} ${t.hint} ${GROUP_TITLES[t.group]}`.toLowerCase().includes(q))
    : [];

  const branch = localStorage.getItem('currentBranch');
  const year = localStorage.getItem('academicYear');
  const showSummary = hasPermission('home.dashboard.main', 'read');
  const name = (user as any)?.name || user?.username || '';

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 py-5 sm:py-7 space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          {greeting()}{name ? `, ${name}` : ''}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {branch && branch !== 'All' ? `${branch} · ` : ''}{year ? `Session ${year}` : ''}
        </p>
      </div>

      {/* "What do you want to do?" */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search: fee, attendance, marks…"
          aria-label="Search for a task"
          className="input h-12 pl-11 pr-10 text-base rounded-xl shadow-card"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 btn-icon h-8 w-8">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {q ? (
        <section aria-live="polite">
          <h2 className="text-sm font-semibold text-slate-500 mb-2">
            {matches.length ? `${matches.length} match${matches.length > 1 ? 'es' : ''}` : 'Nothing found. Try another word, like “fee” or “student”.'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {matches.map(t => <TaskRow key={t.id} task={t} onOpen={open} />)}
          </div>
        </section>
      ) : (
        <>
          {GROUP_ORDER.map(group => {
            const list = myTasks.filter(t => t.group === group);
            if (!list.length) return null;
            const isDaily = group === 'daily';
            return (
              <section key={group}>
                <h2 className="text-base font-semibold text-slate-900 mb-2.5">
                  {isDaily ? 'What do you want to do today?' : GROUP_TITLES[group]}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {list.map(t => <TaskRow key={t.id} task={t} onOpen={open} prominent={isDaily} />)}
                </div>
              </section>
            );
          })}

          {showSummary && (
            <section>
              <h2 className="text-base font-semibold text-slate-900 mb-2.5">Today at a glance</h2>
              <SummaryBar />
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default TaskHome;
