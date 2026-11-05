import React, { useState, useEffect } from 'react';
import { PageHeader, Spinner, Steps, ActionBar, Field, Button } from './ui';

const StaffSupport: React.FC = () => {
    const WHATSAPP_GROUP_LINK = 'https://chat.whatsapp.com/FFcwsA705dt8mMS4FciHxR';

    const [userName, setUserName] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [category, setCategory] = useState('General');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [errors, setErrors] = useState<{ subject?: string; message?: string }>({});
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [step, setStep] = useState(0);

    const categories = [
        { label: 'General',    icon: '💬' },
        { label: 'Technical',  icon: '🔧' },
        { label: 'Attendance', icon: '📋' },
        { label: 'Salary',     icon: '💰' },
        { label: 'Leave',      icon: '🗓️' },
        { label: 'Other',      icon: '📌' },
    ];

    const referenceDocs = [
        { title: 'Academic Module', href: new URL('../images/Academic Module.pdf', import.meta.url).href },
        { title: 'Attendance Module', href: new URL('../images/Attendance Module.pdf', import.meta.url).href },
        { title: 'Fee Module', href: new URL('../images/Fee Module.pdf', import.meta.url).href },
        { title: 'Student Administration Module', href: new URL('../images/Student Administration Module.pdf', import.meta.url).href },
        { title: 'User Management Module', href: new URL('../images/User Management Module.pdf', import.meta.url).href },
    ];

    const faqs = [
        {
            question: 'How do I reset my password?',
            answer: 'Contact your admin or send a support query. We will reset it within 24 hours.',
        },
        {
            question: 'How can I view my attendance records?',
            answer: 'Navigate to the Attendance module from the sidebar under "My Attendance".',
        },
        {
            question: 'How do I apply for leave?',
            answer: 'Go to Leave Management and click "Apply Leave". Fill in details and submit.',
        },
        {
            question: 'When will my salary be credited?',
            answer: 'Salary is processed on the last working day of each month.',
        },
    ];

    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        let name =
            localStorage.getItem('userName') ||
            localStorage.getItem('user_name') ||
            localStorage.getItem('name') ||
            localStorage.getItem('staffName') ||
            localStorage.getItem('displayName') ||
            '';

        if (!name && savedUser) {
            try {
                const userObj = JSON.parse(savedUser);
                name =
                    userObj?.name ||
                    userObj?.username ||
                    userObj?.userName ||
                    userObj?.displayName ||
                    userObj?.fullName ||
                    userObj?.full_name ||
                    userObj?.first_name ||
                    userObj?.staff_name ||
                    '';
            } catch {
                name = '';
            }
        }

        setUserName(name || '');
    }, []);

    const validate = (): boolean => {
        const e: { subject?: string; message?: string } = {};
        if (!subject.trim() || subject.trim().length < 5) {
            e.subject = 'Write a short title of at least 5 letters.';
        }
        if (!message.trim() || message.trim().length < 20) {
            e.message = 'Tell us a little more (at least 20 letters).';
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const buildMessage = (): string => {
        const timestamp = new Date().toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
        return (
            `🎓 *Staff Support Query*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `👤 *From* : ${userName || 'Staff Member'}\n\n` +
            `📋 *Query Details*\n` +
            `• Category : ${category}\n` +
            `• Subject  : ${subject}\n\n` +
            `💬 *Message*\n` +
            `${message}\n\n` +
            `🕐 *Sent on* : ${timestamp}\n` +
            `━━━━━━━━━━━━━━━━━━━━`
        );
    };

    // ── Copy message to clipboard ─────────────────────────────────────────────
    const copyToClipboard = async (text: string): Promise<boolean> => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback for older browsers / non-HTTPS
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.left = '-9999px';
                textarea.style.top = '-9999px';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                const success = document.execCommand('copy');
                document.body.removeChild(textarea);
                return success;
            }
        } catch {
            return false;
        }
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (isSubmitting) return;
        if (!validate()) return;

        setIsSubmitting(true);

        try {
            const text = buildMessage();

            // Step 1: Copy message to clipboard
            const copied = await copyToClipboard(text);
            setIsCopied(copied);

            // Step 2: Open the WhatsApp group
            window.open(WHATSAPP_GROUP_LINK, '_blank', 'noopener,noreferrer');

            setIsSubmitted(true);

            // Auto-reset after 20s
            setTimeout(() => {
                setIsSubmitted(false);
                setStep(0);
                setIsCopied(false);
                setSubject('');
                setMessage('');
                setCategory('General');
                setErrors({});
            }, 20000);
        } catch (err) {
            console.error(err);
            window.open(WHATSAPP_GROUP_LINK, '_blank', 'noopener,noreferrer');
            setIsSubmitted(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Manual copy on success screen ────────────────────────────────────────
    const handleManualCopy = async () => {
        const copied = await copyToClipboard(buildMessage());
        if (copied) {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 3000);
        }
    };

    const WaIcon = ({ cls = 'w-5 h-5' }: { cls?: string }) => (
        <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    );

    const resetForAnother = () => {
        setIsSubmitted(false);
        setIsCopied(false);
        setSubject('');
        setMessage('');
        setCategory('General');
        setErrors({});
        setStep(0);
    };

    const stepLabels = ['What is it about?', 'Write your question', 'Check and send'];
    const writeNote = subject.trim().length < 5
        ? 'Write a short title of at least 5 letters.'
        : message.trim().length < 20
            ? `Tell us a little more (${Math.max(0, 20 - message.trim().length)} more letters needed).`
            : '';

    const goToCheck = () => {
        if (validate()) setStep(2);
    };

    const openWhatsApp = () => window.open(WHATSAPP_GROUP_LINK, '_blank', 'noopener,noreferrer');

    return (
        <div className="min-h-full bg-slate-50 p-4 md:p-6">
            <div className="w-full max-w-[1600px] mx-auto">

                {/* ── Header ── */}
                <PageHeader
                    eyebrow="Help"
                    title="Get help"
                    subtitle="Ask our support team a question on WhatsApp."
                    icon={<WaIcon cls="w-6 h-6 text-emerald-600" />}
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">

                    {/* ══════════════════════════════════════════
                        LEFT — Ask a question (step by step)
                    ══════════════════════════════════════════ */}
                    <div className="lg:col-span-2">
                        <div className="card overflow-hidden">

                            {/* ── Success screen ── */}
                            {isSubmitted ? (
                                <div className="p-5 sm:p-8 flex flex-col items-center text-center">
                                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>

                                    <h2 className="text-xl font-semibold text-slate-900 tracking-tight mb-2">
                                        WhatsApp is open. Now paste and send.
                                    </h2>

                                    <p className={`text-sm font-medium mb-4 ${isCopied ? 'text-emerald-700' : 'text-amber-700'}`}>
                                        {isCopied
                                            ? 'Your message is copied and ready to paste.'
                                            : 'We could not copy your message. Tap "Copy message" below.'}
                                    </p>

                                    {/* Step guide */}
                                    <ol className="bg-green-50 border border-green-200 rounded-2xl p-4 sm:p-5 text-left w-full max-w-md mb-4 space-y-3">
                                        {[
                                            'Go to the WhatsApp group that just opened.',
                                            isCopied
                                                ? 'Long-press the message box and tap Paste (on a computer press Ctrl+V).'
                                                : 'Tap "Copy message" below, then paste it in the message box.',
                                            'Tap Send.',
                                        ].map((text, i) => (
                                            <li key={i} className="flex items-start gap-3">
                                                <span className="bg-green-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                                                    {i + 1}
                                                </span>
                                                <p className="text-[15px] text-green-900">{text}</p>
                                            </li>
                                        ))}
                                    </ol>

                                    {/* Message box — for manual copy */}
                                    <div className="w-full max-w-md mb-4">
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left">
                                            <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                                                {buildMessage()}
                                            </pre>
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex flex-col gap-2 w-full max-w-md">
                                        <Button variant="success" size="lg" onClick={openWhatsApp} icon={<WaIcon cls="w-5 h-5 text-white" />}>
                                            Open WhatsApp again
                                        </Button>
                                        <Button variant="secondary" size="lg" onClick={handleManualCopy}>
                                            {isCopied ? 'Copied' : 'Copy message'}
                                        </Button>
                                        <Button variant="ghost" onClick={resetForAnother}>
                                            Ask another question
                                        </Button>
                                    </div>
                                </div>

                            ) : (
                                /* ── Form ── */
                                <form
                                    onSubmit={e => {
                                        if (step !== 2) { e.preventDefault(); if (step === 1) goToCheck(); return; }
                                        handleSubmit(e);
                                    }}
                                    noValidate
                                    className="p-4 sm:p-6 space-y-5"
                                >
                                    <Steps steps={stepLabels} current={step} onJump={setStep} />

                                    {/* STEP 1: category */}
                                    {step === 0 && (
                                        <div className="space-y-4">
                                            <p className="text-sm text-slate-600">
                                                Sending as <strong className="text-slate-900">{userName || 'Staff Member'}</strong>
                                            </p>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="What is it about?">
                                                {categories.map((cat) => {
                                                    const active = category === cat.label;
                                                    return (
                                                        <button
                                                            type="button"
                                                            role="radio"
                                                            aria-checked={active}
                                                            key={cat.label}
                                                            onClick={() => setCategory(cat.label)}
                                                            className={`min-h-[52px] rounded-xl border px-3 text-left text-[15px] font-medium flex items-center gap-2 transition-colors ${active ? 'bg-green-50 text-green-800 border-green-500 ring-2 ring-green-500/30' : 'bg-white text-slate-700 border-slate-200 hover:border-green-400'}`}
                                                        >
                                                            <span aria-hidden="true">{cat.icon}</span>
                                                            {cat.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* STEP 2: subject + message */}
                                    {step === 1 && (
                                        <div className="space-y-4">
                                            <Field label="Short title" htmlFor="ss-subject" required error={errors.subject} hint="For example: Cannot see my salary slip">
                                                <input
                                                    id="ss-subject"
                                                    type="text"
                                                    value={subject}
                                                    onChange={e => {
                                                        setSubject(e.target.value);
                                                        if (errors.subject) setErrors(p => ({ ...p, subject: undefined }));
                                                    }}
                                                    placeholder="What is the problem?"
                                                    className={`input h-11 ${errors.subject ? 'border-red-400' : ''}`}
                                                />
                                            </Field>
                                            <Field
                                                label="Your question"
                                                htmlFor="ss-message"
                                                required
                                                error={errors.message}
                                                hint={`Tell us what happened and what you need. ${message.length} letters typed.`}
                                            >
                                                <textarea
                                                    id="ss-message"
                                                    value={message}
                                                    onChange={e => {
                                                        setMessage(e.target.value);
                                                        if (errors.message) setErrors(p => ({ ...p, message: undefined }));
                                                    }}
                                                    rows={6}
                                                    placeholder="Write your question here…"
                                                    className={`input resize-none ${errors.message ? 'border-red-400' : ''}`}
                                                />
                                            </Field>
                                        </div>
                                    )}

                                    {/* STEP 3: check and send */}
                                    {step === 2 && (
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-sm font-medium text-slate-800 mb-2">This is the message we will copy for you:</p>
                                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
                                                    <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed break-words">
                                                        {buildMessage()}
                                                    </pre>
                                                </div>
                                            </div>
                                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                                                <WaIcon cls="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                                <p className="text-sm text-green-900 leading-relaxed">
                                                    When you tap the green button, we copy your message and open the support WhatsApp group.
                                                    Then paste it in the message box and tap Send.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <ActionBar
                                        className="!mt-2"
                                        note={step === 1 && writeNote ? writeNote : undefined}
                                    >
                                        {step > 0 && (
                                            <Button variant="secondary" size="lg" onClick={() => setStep(step - 1)}>
                                                Back
                                            </Button>
                                        )}
                                        {step === 0 && (
                                            <Button size="lg" onClick={() => setStep(1)}>
                                                Next
                                            </Button>
                                        )}
                                        {step === 1 && (
                                            <Button size="lg" onClick={goToCheck} disabled={!!writeNote}>
                                                Next
                                            </Button>
                                        )}
                                        {step === 2 && (
                                            <button
                                                type="submit"
                                                disabled={isSubmitting}
                                                className="btn-success btn-lg"
                                            >
                                                {isSubmitting ? (
                                                    <>
                                                        <Spinner size="sm" className="text-white" />
                                                        Opening WhatsApp…
                                                    </>
                                                ) : (
                                                    <>
                                                        <WaIcon cls="w-5 h-5 text-white" />
                                                        Copy and open WhatsApp
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </ActionBar>
                                </form>
                            )}
                        </div>

                        {/* ── Guides (PDF) ── */}
                        <div className="card p-4 sm:p-5 mt-4">
                            <h2 className="text-base font-semibold text-slate-900">How-to guides</h2>
                            <p className="text-sm text-slate-500 mt-0.5 mb-3">Tap a guide to open it.</p>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {referenceDocs.map((doc, i) => (
                                    <li key={i}>
                                        <a
                                            href={doc.href}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-3 min-h-[48px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 hover:bg-green-50 hover:border-green-400"
                                        >
                                            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/>
                                            </svg>
                                            <span className="flex-1">{doc.title.replace(' Module', '')} guide</span>
                                            <span className="text-green-700" aria-hidden="true">↗</span>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* ══════════════════════════════════════════
                        RIGHT — Info panel
                    ══════════════════════════════════════════ */}
                    <div className="space-y-4">

                        {/* Join group card */}
                        <div className="card p-4 sm:p-5">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="bg-green-100 p-2 rounded-lg">
                                    <WaIcon cls="w-5 h-5 text-green-600" />
                                </div>
                                <h2 className="text-base font-semibold text-slate-900">Support WhatsApp group</h2>
                            </div>
                            <p className="text-sm text-slate-600 mb-3 leading-relaxed">
                                All staff questions are answered in this group. Join it once so you can get help quickly.
                            </p>
                            <Button variant="secondary" className="w-full min-h-[44px]" onClick={openWhatsApp} icon={<WaIcon cls="w-4 h-4 text-green-600" />}>
                                Join the support group
                            </Button>
                        </div>

                        {/* Support hours */}
                        <div className="card p-4 sm:p-5">
                            <h2 className="text-base font-semibold text-slate-900 mb-3">When we answer</h2>
                            <div className="space-y-2.5">
                                {[
                                    { day: 'Monday – Friday', time: '9:00 AM – 6:00 PM', active: true },
                                    { day: 'Saturday',        time: '9:00 AM – 2:00 PM', active: true },
                                    { day: 'Sunday',          time: 'Closed',             active: false },
                                ].map((item, i) => (
                                    <div key={i} className="flex justify-between items-center gap-2">
                                        <span className="text-sm text-slate-700">{item.day}</span>
                                        <span className={item.active ? 'badge-success' : 'badge-danger'}>
                                            {item.time}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                                {[
                                    { label: 'WhatsApp group',  time: 'within 1 hour' },
                                    { label: 'Urgent problems', time: 'within 30 minutes' },
                                    { label: 'Other questions', time: 'within 4 hours' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between gap-2">
                                        <span className="text-sm text-slate-700">{item.label}</span>
                                        <span className="text-sm font-semibold text-slate-900">{item.time}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* FAQ accordion */}
                        <div className="card p-4 sm:p-5">
                            <h2 className="text-base font-semibold text-slate-900 mb-3">Common questions</h2>
                            <div className="space-y-2">
                                {faqs.map((faq, i) => (
                                    <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
                                        <button
                                            type="button"
                                            aria-expanded={openFaq === i}
                                            onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                            className="w-full text-left px-4 min-h-[48px] py-2 flex items-center justify-between hover:bg-slate-50 transition-colors"
                                        >
                                            <span className="text-sm font-medium text-slate-800 pr-2">{faq.question}</span>
                                            <svg
                                                className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}
                                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                        {openFaq === i && (
                                            <div className="px-4 pb-3 bg-green-50 border-t border-slate-100">
                                                <p className="text-sm text-slate-700 leading-relaxed pt-2">{faq.answer}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StaffSupport;