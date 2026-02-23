import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Loader2, ShieldCheck, ArrowLeft, RefreshCw } from 'lucide-react';
import { useVerifyOTP, useResendOtp } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';
import { ROUTES } from '@/core/constants/constants';
import { toast } from 'sonner';

const OTP_LENGTH = 6;

export function OTPPage() {
  const { verifyOTP, loading } = useVerifyOTP();
  const { resendOtp, loading: resending } = useResendOtp();
  const { otpUserId } = useAuthStore();
  const navigate = useNavigate();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if no OTP session
  useEffect(() => {
    if (!otpUserId) navigate(ROUTES.LOGIN);
  }, [otpUserId, navigate]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);

  const formattedTime = `${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}`;

  const updateDigit = (index: number, value: string) => {
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) {
      toast.error('Please enter the complete 6-digit OTP');
      return;
    }
    verifyOTP(otp);
  };

  const handleResend = async () => {
    await resendOtp();
    setDigits(Array(OTP_LENGTH).fill(''));
    setTimeLeft(300);
    inputRefs.current[0]?.focus();
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
            Check your email
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] text-center mb-6">
            We've sent a 6-digit code to your email. It expires in{' '}
            <span className={timeLeft <= 60 ? 'text-danger-500 font-medium' : 'font-medium text-[var(--foreground)]'}>
              {formattedTime}
            </span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
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
                  className="w-11 h-13 text-center text-xl font-bold rounded-xl border-2 bg-[var(--background)] text-[var(--foreground)] transition focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  style={{ borderColor: digit ? 'var(--primary)' : 'var(--input)' }}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || timeLeft <= 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 text-white font-semibold text-sm transition-all shadow-sm shadow-brand-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Verifying...' : timeLeft <= 0 ? 'OTP Expired' : 'Verify OTP'}
            </button>
          </form>

          {/* Resend OTP */}
          <div className="mt-4 text-center">
            <button
              onClick={handleResend}
              disabled={resending || loading || timeLeft > 0}
              className="inline-flex items-center gap-1.5 text-sm text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {resending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {resending ? 'Sending...' : timeLeft > 0 ? `Resend in ${formattedTime}` : 'Resend OTP'}
            </button>
          </div>
        </div>

        <button
          onClick={() => navigate(ROUTES.LOGIN)}
          className="flex items-center gap-1.5 mx-auto mt-4 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to login
        </button>
      </div>
    </div>
  );
}