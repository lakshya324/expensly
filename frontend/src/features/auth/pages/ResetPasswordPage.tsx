import { useRef, useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Wallet, Loader2, ShieldCheck, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/core/constants/constants';
import { useResetPassword } from '../hooks/useAuth';
import { resetPasswordSchema, type ResetPasswordFormValues } from '../validators';

const OTP_LENGTH = 6;

export function ResetPasswordPage() {
  const { resetPassword, loading } = useResetPassword();
  const location = useLocation();
  const navigate = useNavigate();
  const userId = (location.state as { userId?: string })?.userId ?? '';

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) });

  const updateDigit = (index: number, value: string) => {
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    if (value && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    const newDigits = Array(OTP_LENGTH).fill('');
    text.split('').forEach((char, i) => { newDigits[i] = char; });
    setDigits(newDigits);
    inputRefs.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus();
  };

  if (!userId) {
    navigate(ROUTES.FORGOT_PASSWORD);
    return null;
  }

  const onSubmit = (data: ResetPasswordFormValues) => {
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) return;
    resetPassword(userId, otp, data.newPassword);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-brand-300/20 blur-3xl dark:bg-brand-700/20" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-brand-200/30 blur-3xl dark:bg-brand-900/30" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 dark:bg-brand-500 shadow-lg shadow-brand-500/30 mb-4">
            <Wallet className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Expensly</h1>
        </div>

        <div className="bg-[var(--card)] rounded-2xl shadow-xl border border-[var(--border)] p-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-950 mx-auto mb-4">
            <ShieldCheck className="w-6 h-6 text-brand-600 dark:text-brand-400" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--foreground)] text-center mb-1">
            Reset your password
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] text-center mb-6">
            Enter the OTP sent to your email and choose a new password.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* OTP Input */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                One-Time Password
              </label>
              <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => updateDigit(i, e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className="w-11 h-12 text-center text-xl font-bold rounded-xl border-2 bg-[var(--background)] text-[var(--foreground)] transition focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    style={{ borderColor: digit ? 'var(--primary)' : 'var(--input)' }}
                  />
                ))}
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                New password
              </label>
              <div className="relative">
                <input
                  {...register('newPassword')}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[var(--input)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="mt-1.5 text-xs text-danger-500">{errors.newPassword.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Confirm new password
              </label>
              <div className="relative">
                <input
                  {...register('confirmPassword')}
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[var(--input)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1.5 text-xs text-danger-500">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || digits.join('').length < OTP_LENGTH}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 text-white font-semibold text-sm transition-all shadow-sm shadow-brand-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        </div>

        <Link
          to={ROUTES.FORGOT_PASSWORD}
          className="flex items-center justify-center gap-1.5 mt-4 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </div>
    </div>
  );
}
