import React, { useState } from 'react';
import { Phone } from 'lucide-react';
import { UserIcon } from '../icons';

/** Round student photo with a plain placeholder when there is no photo (or it fails to load). */
export const StudentAvatar: React.FC<{ src?: string; name?: string; size?: 'sm' | 'md' | 'lg' }> = ({ src, name, size = 'md' }) => {
    const [failed, setFailed] = useState(false);
    const box = size === 'lg' ? 'h-24 w-24' : size === 'sm' ? 'h-9 w-9' : 'h-12 w-12';
    const icon = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-5 w-5' : 'h-7 w-7';
    if (src && !failed) {
        return (
            <img
                src={src}
                alt={name || 'Student photo'}
                className={`${box} flex-shrink-0 rounded-full border border-slate-200 object-cover`}
                onError={() => setFailed(true)}
            />
        );
    }
    return (
        <div className={`${box} flex-shrink-0 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center`}>
            <UserIcon className={`${icon} text-slate-400`} />
        </div>
    );
};

/** Phone number as a tap-to-call link. Clicks don't bubble (safe inside clickable rows). */
export const PhoneLink: React.FC<{ phone?: string | number | null; className?: string }> = ({ phone, className = '' }) => {
    const value = `${phone ?? ''}`.trim();
    if (!value) return <span className="text-slate-400">—</span>;
    return (
        <a
            href={`tel:${value.replace(/[^\d+]/g, '')}`}
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline ${className}`}
        >
            <Phone className="h-4 w-4" />
            {value}
        </a>
    );
};

/** "Class 5 - A" style label. */
export const classLabel = (cls?: string, section?: string) => {
    if (!cls && !section) return '—';
    return [cls, section].filter(Boolean).join(' - ');
};
