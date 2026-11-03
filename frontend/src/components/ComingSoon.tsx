import React from 'react';
import { Construction } from 'lucide-react';

const ComingSoon: React.FC<{ pageTitle: string }> = ({ pageTitle }) => (
  <div className="flex items-center justify-center h-full p-6">
    <div className="card px-10 py-12 text-center max-w-md w-full">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-5">
        <Construction className="w-7 h-7" />
      </div>
      <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">{pageTitle}</h1>
      <p className="mt-2 text-sm text-slate-500">This page is under construction.</p>
      <p className="mt-1 text-xs text-slate-400">Please check back later!</p>
    </div>
  </div>
);

export default ComingSoon;
