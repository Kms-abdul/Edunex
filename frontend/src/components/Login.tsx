import React, { useState } from 'react';
import axios from "axios";
import { API_URL } from "../config";
import { auth } from '../api';
import { User, Lock, Eye, EyeOff, ArrowRight, Mail, KeyRound, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import Learnspacelogo from '../images/Learnspacelogo.png';
import LoginBg from '../images/LoginBg.png';
import DeLogo from '../images/DE LOGO.png';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

type ViewState = 'login' | 'forgot-email' | 'forgot-otp' | 'forgot-reset';

/* ── Presentational building blocks ─────────────────────────────────── */
const Field: React.FC<{ icon: React.ReactNode; children: React.ReactNode; trailing?: React.ReactNode }> = ({ icon, children, trailing }) => (
  <div className="group flex items-center gap-3 h-12 rounded-xl border border-slate-200 bg-white px-3.5 transition-all focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 hover:border-slate-300">
    <span className="text-slate-400 group-focus-within:text-brand-600 flex-shrink-0">{icon}</span>
    {children}
    {trailing}
  </div>
);

const fieldInput = "flex-1 min-w-0 h-full !border-0 !bg-transparent !shadow-none !ring-0 text-[15px] text-slate-800 placeholder:text-slate-400 focus:!outline-none focus:!shadow-none focus:!ring-0 p-0";

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
          if (yearsList.length > 0) localStorage.setItem('academicYear', yearsList[0].name);
        } catch (err) {
          console.warn('Could not fetch academic years during login', err);
        }
      } catch (ex) {
        console.warn('Could not persist to localStorage', ex);
      }

      onLoginSuccess(response.data.user);
      setLoading(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Invalid username or password';
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
      setMessage(response.data.message || 'OTP has been sent to your email.');
      setView('forgot-otp');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to send OTP.');
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
      setMessage('OTP verified. Please set a new password.');
      setView('forgot-reset');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Invalid OTP.');
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
      setMessage(response.data.message || 'Password successfully reset! You can now login.');
      setTimeout(() => {
        setView('login');
        setEmail('');
        setOtp('');
        setNewPassword('');
        setPassword('');
      }, 2000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<ViewState, { title: string; subtitle: string }> = {
    'login': { title: 'Welcome back', subtitle: 'Sign in to your LearnSpace account to continue.' },
    'forgot-email': { title: 'Reset your password', subtitle: 'Enter your registered email address to receive an OTP.' },
    'forgot-otp': { title: 'Verify OTP', subtitle: `We've sent a 6-digit OTP to ${email}` },
    'forgot-reset': { title: 'Set a new password', subtitle: 'OTP verified! Please enter your new password below.' },
  };

  /* ══════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen w-full flex bg-white">
      {/* ── LEFT PANEL (brand visual) ── */}
      <div className="hidden lg:block lg:w-[46%] xl:w-1/2 relative overflow-hidden bg-[#eef4fd]" aria-hidden="true">
        <img
          src={LoginBg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
        <div className="absolute inset-y-0 right-0 w-px bg-slate-200/60" />
      </div>

      {/* ── RIGHT PANEL (form) ── */}
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="flex-1 flex items-center justify-center px-6 py-10 sm:px-12">
          <div className="w-full max-w-[400px] animate-fade-in">
            {/* Logo */}
            <div className="flex flex-col items-center text-center mb-8">
              <img src={Learnspacelogo} alt="MS LearnSpace" className="h-20 w-auto object-contain mb-4" />
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{titles[view].title}</h1>
              <p className="text-sm text-slate-500 mt-1.5">{titles[view].subtitle}</p>
            </div>

            {/* ════ LOGIN VIEW ════ */}
            {view === 'login' && (
              <form onSubmit={handleLogin} noValidate className="space-y-4">
                {/* Username */}
                <div>
                  <label htmlFor="login-username" className="label">Username</label>
                  <Field icon={<User className="w-[18px] h-[18px]" />}>
                    <input
                      id="login-username"
                      type="text"
                      placeholder="Enter your username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={fieldInput}
                      autoComplete="username"
                    />
                  </Field>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="label !mb-0">Password</label>
                    <button
                      type="button"
                      className="text-xs font-medium text-brand-600 hover:text-brand-700"
                      onClick={() => { setView('forgot-email'); resetMessages(); }}
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <Field
                    icon={<Lock className="w-[18px] h-[18px]" />}
                    trailing={
                      <button
                        type="button"
                        className="text-slate-400 hover:text-slate-600 flex-shrink-0"
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                      </button>
                    }
                  >
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={fieldInput}
                      autoComplete="current-password"
                    />
                  </Field>
                </div>

                {error && <Alert kind="error">{error}</Alert>}
                {message && <Alert kind="success">{message}</Alert>}

                {/* Login button */}
                <PrimaryButton id="login-submit" type="submit" loading={loading} loadingText="Logging in…" title="Login to your account" className="mt-2">
                  Login <ArrowRight className="w-4 h-4" />
                </PrimaryButton>
              </form>
            )}

            {/* ════ FORGOT PASSWORD – EMAIL VIEW ════ */}
            {view === 'forgot-email' && (
              <form onSubmit={handleForgotPassword} noValidate className="space-y-4">
                <div>
                  <label htmlFor="forgot-email-input" className="label">Email Address</label>
                  <Field icon={<Mail className="w-[18px] h-[18px]" />}>
                    <input
                      id="forgot-email-input"
                      type="email"
                      placeholder="you@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={fieldInput}
                      autoComplete="email"
                    />
                  </Field>
                </div>

                {error && <Alert kind="error">{error}</Alert>}

                <PrimaryButton id="forgot-send-otp" type="submit" loading={loading} loadingText="Sending OTP…">
                  Send OTP <ArrowRight className="w-4 h-4" />
                </PrimaryButton>

                <div className="text-center pt-1">
                  <button type="button" className="text-sm text-slate-500 hover:text-slate-800" onClick={() => { setView('login'); resetMessages(); }}>
                    ← Back to Login
                  </button>
                </div>
              </form>
            )}

            {/* ════ FORGOT PASSWORD – OTP VIEW ════ */}
            {view === 'forgot-otp' && (
              <form onSubmit={handleVerifyOTP} noValidate className="space-y-4">
                <div>
                  <label htmlFor="forgot-otp-input" className="label">One-time password</label>
                  <Field icon={<KeyRound className="w-[18px] h-[18px]" />}>
                    <input
                      id="forgot-otp-input"
                      type="text"
                      placeholder="• • • • • •"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className={`${fieldInput} tracking-[0.35em] text-center font-semibold`}
                    />
                  </Field>
                </div>

                {error && <Alert kind="error">{error}</Alert>}
                {message && <Alert kind="success">{message}</Alert>}

                <PrimaryButton id="forgot-verify-otp" type="submit" loading={loading} loadingText="Verifying…">
                  Verify OTP <ShieldCheck className="w-4 h-4" />
                </PrimaryButton>

                <div className="flex items-center justify-between pt-1">
                  <button type="button" className="text-sm text-slate-500 hover:text-slate-800" onClick={() => { setView('forgot-email'); resetMessages(); }}>
                    Change Email
                  </button>
                  <button type="button" className="text-sm font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50" onClick={() => requestOtp()} disabled={loading}>
                    Resend OTP
                  </button>
                </div>
              </form>
            )}

            {/* ════ FORGOT PASSWORD – RESET VIEW ════ */}
            {view === 'forgot-reset' && (
              <form onSubmit={handleResetPassword} noValidate className="space-y-4">
                <div>
                  <label htmlFor="reset-new-password" className="label">New Password</label>
                  <Field
                    icon={<Lock className="w-[18px] h-[18px]" />}
                    trailing={
                      <button
                        type="button"
                        className="text-slate-400 hover:text-slate-600 flex-shrink-0"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                      </button>
                    }
                  >
                    <input
                      id="reset-new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Minimum 8 characters"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={fieldInput}
                      autoComplete="new-password"
                    />
                  </Field>
                </div>

                {error && <Alert kind="error">{error}</Alert>}
                {message && <Alert kind="success">{message}</Alert>}

                <PrimaryButton id="reset-submit" type="submit" loading={loading} loadingText="Resetting…">
                  Set New Password <ArrowRight className="w-4 h-4" />
                </PrimaryButton>

                <div className="text-center pt-1">
                  <button type="button" className="text-sm text-slate-500 hover:text-slate-800" onClick={() => { setView('login'); resetMessages(); }}>
                    Cancel & Back to Login
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 sm:px-12 py-5 border-t border-slate-100">
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} MS LearnSpace · School ERP</p>
          <img src={DeLogo} alt="DE" className="h-8 w-auto object-contain opacity-90" />
        </div>
      </div>
    </div>
  );
};

export default Login;
