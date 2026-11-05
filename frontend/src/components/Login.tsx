import React, { useState } from 'react';
import axios from "axios";
import { API_URL } from "../config";
import { auth } from '../api';
import { User, Lock, Eye, EyeOff, ArrowRight, Mail, KeyRound, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import KampusOpsLogo from '../images/kampusops-logo.webp';
import KampusOpsMark from '../images/kampusops-mark.webp';
import DeLogo from '../images/DE LOGO.webp';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

type ViewState = 'login' | 'forgot-email' | 'forgot-otp' | 'forgot-reset';

/* ── Presentational building blocks ─────────────────────────────────── */
const Field: React.FC<{ icon: React.ReactNode; children: React.ReactNode; trailing?: React.ReactNode }> = ({ icon, children, trailing }) => (
  <div className="group flex items-center gap-3 h-14 rounded-xl border border-slate-300 bg-white px-3.5 transition-all focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 hover:border-slate-300">
    <span className="text-slate-400 group-focus-within:text-brand-600 flex-shrink-0">{icon}</span>
    {children}
    {trailing}
  </div>
);

const fieldInput = "flex-1 min-w-0 h-full !border-0 !bg-transparent !shadow-none !ring-0 text-base text-slate-900 placeholder:text-slate-400 focus:!outline-none focus:!shadow-none focus:!ring-0 p-0";

const Alert: React.FC<{ kind: 'error' | 'success'; children: React.ReactNode }> = ({ kind, children }) => (
  <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${kind === 'error' ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/15' : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15'}`}>
    {kind === 'error' ? <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />}
    <span>{children}</span>
  </div>
);

const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; loadingText?: string }> = ({ loading, loadingText, children, className, ...rest }) => (
  <button
    {...rest}
    disabled={loading || rest.disabled}
    className={`w-full h-12 rounded-xl bg-brand-600 text-brand-contrast font-semibold text-[15px] inline-flex items-center justify-center gap-2 shadow-md shadow-brand-600/20 hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed ${className || ''}`}
  >
    {loading ? (
      <>
        <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
        {loadingText}
      </>
    ) : children}
  </button>
);

/* ════════════════════════════════════════════════════════════════════
   Main Component
   ════════════════════════════════════════════════════════════════════ */
const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [view, setView] = useState<ViewState>('login');
  const [showPassword, setShowPassword] = useState(false);

  // Login states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Forgot Password states
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const resetMessages = () => { setError(''); setMessage(''); };

  /* ── Login ── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      localStorage.removeItem('branch');
      localStorage.removeItem('location');
      localStorage.removeItem('academicYear');
      localStorage.removeItem('academicYearDefaultVersion');
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      localStorage.removeItem('currentBranch');
      localStorage.removeItem('currentBranchId');
      localStorage.removeItem('currentSchool');
      localStorage.removeItem('currentSchoolId');
      localStorage.removeItem('currentLocation');

      const response = await axios.post(`${API_URL}/users/login`, { username, password });
      console.log('Login successful:', response.data);

      try {
        if (response.data.token) {
          auth.setToken(response.data.token);
        }
        if (response.data.user) {
          localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        try {
          const yearsRes = await axios.get(`${API_URL}/org/academic-years`, {
            headers: { Authorization: `Bearer ${response.data.token}` },
          });
          const yearsList = yearsRes.data.academic_years || [];
          const targetDefaultYear = '2026-2027';
          const defaultYear = yearsList.find((y: any) => y.name === targetDefaultYear)?.name
            || (yearsList.length > 0 ? yearsList[0].name : targetDefaultYear);
          localStorage.setItem('academicYear', defaultYear);
          localStorage.setItem('academicYearDefaultVersion', defaultYear);
        } catch (err) {
          console.warn('Could not fetch academic years during login', err);
          localStorage.setItem('academicYear', '2026-2027');
          localStorage.setItem('academicYearDefaultVersion', '2026-2027');
        }
      } catch (ex) {
        console.warn('Could not persist to localStorage', ex);
      }

      onLoginSuccess(response.data.user);
      setLoading(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Wrong username or password. Please try again.';
      setError(msg);
      setLoading(false);
    }
  };

  /* ── Forgot password – request OTP ── */
  const requestOtp = async () => {
    resetMessages();
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/users/forgot-password`, { email });
      setMessage(response.data.message || 'We sent a code to your email.');
      setView('forgot-otp');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not send the code. Check the email address and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestOtp();
  };

  /* ── Verify OTP ── */
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      await axios.post(`${API_URL}/users/verify-otp`, { email, otp });
      setMessage('Code is correct. Now choose a new password.');
      setView('forgot-reset');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'That code is not correct. Check your email and try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Reset password ── */
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/users/reset-password`, {
        email,
        otp,
        new_password: newPassword,
      });
      setMessage(response.data.message || 'Password changed. You can now sign in.');
      setTimeout(() => {
        setView('login');
        setEmail('');
        setOtp('');
        setNewPassword('');
        setPassword('');
      }, 2000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not change the password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<ViewState, { title: string; subtitle: string }> = {
    'login': { title: 'Sign in', subtitle: 'Type your username and password to open KampusOps.' },
    'forgot-email': { title: 'Forgot password?', subtitle: 'We will email you a 6-digit code to set a new password.' },
    'forgot-otp': { title: 'Check your email', subtitle: `Type the 6-digit code we sent to ${email}` },
    'forgot-reset': { title: 'Choose a new password', subtitle: 'Your code is correct. Now type a new password.' },
  };

  const forgotSteps: ViewState[] = ['forgot-email', 'forgot-otp', 'forgot-reset'];
  const forgotIndex = forgotSteps.indexOf(view);
  const forgotLabels = ['Your email', 'Code from email', 'New password'];

  const backToLogin = () => { setView('login'); resetMessages(); };

  const linkButton = "inline-flex items-center justify-center min-h-[44px] px-2 text-sm font-medium";

  /* ══════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen w-full flex bg-white">
      {/* ── LEFT PANEL (brand visual) ── */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-1/2 relative overflow-hidden flex-col justify-between bg-gradient-to-br from-[#eef4ff] via-white to-[#fff4e8] px-12 xl:px-16 py-12" aria-hidden="true">
        {/* soft brand shapes */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-10 h-72 w-72 rounded-full bg-orange-100/70 blur-3xl" />
        <img src={KampusOpsMark} alt="" className="pointer-events-none absolute right-10 bottom-10 w-64 opacity-[0.07]" />

        <img src={KampusOpsLogo} alt="" className="relative h-14 w-auto self-start object-contain" />

        <div className="relative max-w-md">
          <h2 className="text-4xl xl:text-5xl font-bold leading-tight tracking-tight text-[#14204a]">
            Your whole school,<br />in one simple app.
          </h2>
          <p className="mt-4 text-lg text-slate-600">Fees, attendance, marks and staff — easy enough for everyone, on any phone or computer.</p>
          <ul className="mt-8 space-y-3 text-[15px] text-slate-700">
            {['Collect fees and print receipts', 'Take attendance in a few taps', 'Marks, report cards and timetables', 'Staff attendance and details'].map(t => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white"><CheckCircle2 className="h-4 w-4" /></span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-slate-500">KampusOps · School Management Platform</p>
        <div className="absolute inset-y-0 right-0 w-px bg-slate-200/70" />
      </div>

      {/* ── RIGHT PANEL (form) ── */}
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="flex-1 flex items-start sm:items-center justify-center px-4 pt-8 pb-10 sm:px-12 sm:py-10">
          <div className="w-full max-w-[400px] animate-fade-in">
            {/* Logo */}
            <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
              <img src={KampusOpsLogo} alt="KampusOps — School Management Platform" className="h-12 sm:h-14 w-auto max-w-full object-contain mb-6" />
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{titles[view].title}</h1>
              <p className="text-[15px] text-slate-600 mt-1.5">{titles[view].subtitle}</p>
            </div>

            {/* Step progress for the forgot-password flow */}
            {forgotIndex >= 0 && (
              <div className="mb-5" aria-label="Progress">
                <p className="text-sm text-slate-500">Step {forgotIndex + 1} of 3 · {forgotLabels[forgotIndex]}</p>
                <div className="mt-2 flex gap-1.5">
                  {forgotLabels.map((label, i) => (
                    <span key={label} className={`h-1.5 flex-1 rounded-full ${i <= forgotIndex ? 'bg-brand-600' : 'bg-slate-200'}`} />
                  ))}
                </div>
              </div>
            )}

            {/* ════ LOGIN VIEW ════ */}
            {view === 'login' && (
              <form onSubmit={handleLogin} noValidate className="space-y-5">
                {/* Username */}
                <div>
                  <label htmlFor="login-username" className="label text-[15px]">Your username</label>
                  <Field icon={<User className="w-5 h-5" />}>
                    <input
                      id="login-username"
                      name="username"
                      type="text"
                      placeholder="Type your username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={fieldInput}
                      autoComplete="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="next"
                    />
                  </Field>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="login-password" className="label text-[15px]">Your password</label>
                  <Field
                    icon={<Lock className="w-5 h-5" />}
                    trailing={
                      <button
                        type="button"
                        className="-mr-2 inline-flex items-center justify-center h-11 w-11 text-slate-500 hover:text-slate-700 flex-shrink-0"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    }
                  >
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Type your password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={fieldInput}
                      autoComplete="current-password"
                      enterKeyHint="go"
                    />
                  </Field>
                </div>

                {error && <Alert kind="error">{error}</Alert>}
                {message && <Alert kind="success">{message}</Alert>}

                {/* Sign in button */}
                <PrimaryButton id="login-submit" type="submit" loading={loading} loadingText="Signing in…" className="!h-14 text-base">
                  Sign in <ArrowRight className="w-5 h-5" />
                </PrimaryButton>

                <div className="text-center">
                  <button
                    type="button"
                    className={`${linkButton} text-brand-700 hover:text-brand-800`}
                    onClick={() => { setView('forgot-email'); resetMessages(); }}
                  >
                    Forgot password?
                  </button>
                </div>
              </form>
            )}

            {/* ════ FORGOT PASSWORD – STEP 1: EMAIL ════ */}
            {view === 'forgot-email' && (
              <form onSubmit={handleForgotPassword} noValidate className="space-y-5">
                <div>
                  <label htmlFor="forgot-email-input" className="label text-[15px]">Your email address</label>
                  <Field icon={<Mail className="w-5 h-5" />}>
                    <input
                      id="forgot-email-input"
                      name="email"
                      type="email"
                      inputMode="email"
                      placeholder="name@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={fieldInput}
                      autoComplete="email"
                      autoCapitalize="none"
                      enterKeyHint="send"
                    />
                  </Field>
                  <p className="mt-1.5 text-sm text-slate-500">Use the email address saved on your account.</p>
                </div>

                {error && <Alert kind="error">{error}</Alert>}

                <PrimaryButton id="forgot-send-otp" type="submit" loading={loading} loadingText="Sending code…" disabled={!email.trim()} className="!h-14 text-base">
                  Send me a code <ArrowRight className="w-5 h-5" />
                </PrimaryButton>

                <div className="text-center">
                  <button type="button" className={`${linkButton} text-slate-600 hover:text-slate-900`} onClick={backToLogin}>
                    ← Back to sign in
                  </button>
                </div>
              </form>
            )}

            {/* ════ FORGOT PASSWORD – STEP 2: CODE ════ */}
            {view === 'forgot-otp' && (
              <form onSubmit={handleVerifyOTP} noValidate className="space-y-5">
                <div>
                  <label htmlFor="forgot-otp-input" className="label text-[15px]">6-digit code</label>
                  <Field icon={<KeyRound className="w-5 h-5" />}>
                    <input
                      id="forgot-otp-input"
                      name="otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="• • • • • •"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className={`${fieldInput} tracking-[0.35em] text-center font-semibold text-lg`}
                      autoComplete="one-time-code"
                      enterKeyHint="next"
                    />
                  </Field>
                  <p className="mt-1.5 text-sm text-slate-500">Not there? Check your spam folder, or tap “Send the code again”.</p>
                </div>

                {error && <Alert kind="error">{error}</Alert>}
                {message && <Alert kind="success">{message}</Alert>}

                <PrimaryButton id="forgot-verify-otp" type="submit" loading={loading} loadingText="Checking…" disabled={!otp.trim()} className="!h-14 text-base">
                  Check code <ShieldCheck className="w-5 h-5" />
                </PrimaryButton>

                <div className="flex items-center justify-between gap-2">
                  <button type="button" className={`${linkButton} text-slate-600 hover:text-slate-900`} onClick={() => { setView('forgot-email'); resetMessages(); }}>
                    ← Change email
                  </button>
                  <button type="button" className={`${linkButton} text-brand-700 hover:text-brand-800 disabled:opacity-50`} onClick={() => requestOtp()} disabled={loading}>
                    Send the code again
                  </button>
                </div>
              </form>
            )}

            {/* ════ FORGOT PASSWORD – STEP 3: NEW PASSWORD ════ */}
            {view === 'forgot-reset' && (
              <form onSubmit={handleResetPassword} noValidate className="space-y-5">
                {/* Hidden username field helps password managers save the new password */}
                <input type="email" name="email" value={email} autoComplete="username" readOnly hidden />
                <div>
                  <label htmlFor="reset-new-password" className="label text-[15px]">New password</label>
                  <Field
                    icon={<Lock className="w-5 h-5" />}
                    trailing={
                      <button
                        type="button"
                        className="-mr-2 inline-flex items-center justify-center h-11 w-11 text-slate-500 hover:text-slate-700 flex-shrink-0"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    }
                  >
                    <input
                      id="reset-new-password"
                      name="new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 8 characters"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={fieldInput}
                      autoComplete="new-password"
                      enterKeyHint="done"
                    />
                  </Field>
                  <p className="mt-1.5 text-sm text-slate-500">Use at least 8 characters. Tap the eye to see what you typed.</p>
                </div>

                {error && <Alert kind="error">{error}</Alert>}
                {message && <Alert kind="success">{message}</Alert>}

                <PrimaryButton id="reset-submit" type="submit" loading={loading} loadingText="Saving…" disabled={!newPassword} className="!h-14 text-base">
                  Save new password <ArrowRight className="w-5 h-5" />
                </PrimaryButton>

                <div className="text-center">
                  <button type="button" className={`${linkButton} text-slate-600 hover:text-slate-900`} onClick={backToLogin}>
                    Cancel and go back to sign in
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 sm:px-12 py-5 border-t border-slate-100">
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} KampusOps · School Management Platform</p>
          <img src={DeLogo} alt="DE" className="h-8 w-auto object-contain opacity-90" />
        </div>
      </div>
    </div>
  );
};

export default Login;
