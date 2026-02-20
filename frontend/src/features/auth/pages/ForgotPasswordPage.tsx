import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Wallet, Loader2, ArrowLeft, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/core/constants/constants';
import { useForgotPassword } from '../hooks/useAuth';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '../validators';

export function ForgotPasswordPage() {
  const { forgotPassword, loading } = useForgotPassword();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = (data: ForgotPasswordFormValues) => forgotPassword(data.email);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-brand-300/20 blur-3xl dark:bg-brand-700/20" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-brand-200/30 blur-3xl dark:bg-brand-900/30" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 dark:bg-brand-500 shadow-lg shadow-brand-500/30 mb-4">
            <Wallet className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Expensly</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Smart expense management</p>
        </div>

        {/* Card */}
        <div className="bg-[var(--card)] rounded-2xl shadow-xl border border-[var(--border)] p-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-950 mx-auto mb-4">
            <Mail className="w-6 h-6 text-brand-600 dark:text-brand-400" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--foreground)] text-center mb-1">
            Forgot your password?
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] text-center mb-6">
            Enter your email address and we'll send you a one-time code to reset your password.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                Email address
              </label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--input)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              />
              {errors.email && (
                <p className="mt-1.5 text-xs text-danger-500">{errors.email.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 text-white font-semibold text-sm transition-all shadow-sm shadow-brand-500/30 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Sending OTP...' : 'Send Reset OTP'}
            </button>
          </form>
        </div>

        <Link
          to={ROUTES.LOGIN}
          className="flex items-center justify-center gap-1.5 mt-4 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to login
        </Link>
      </div>
    </div>
  );
}
