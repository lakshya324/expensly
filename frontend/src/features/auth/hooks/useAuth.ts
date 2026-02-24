import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import apiClient from '@/infrastructure/api/client';
import { EP } from '@/infrastructure/api/endpoints';
import { useAuthStore } from '../store/authStore';
import { ROUTES } from '@/core/constants/constants';
import type { IUserData } from '@/core/types/user.types';
import type { Role } from '@/core/types/api.types';

type ApiErr = { response?: { data?: { message?: string } } };
const errMsg = (e: unknown, fallback: string) =>
  (e as ApiErr)?.response?.data?.message ?? fallback;

function roleHome(role: Role): string {
  if (role === 'super_admin') return ROUTES.SA_ORGANIZATIONS;
  if (role === 'admin') return ROUTES.ADMIN_DASHBOARD;
  return ROUTES.USER_DASHBOARD;
}

export function useLogin() {
  const [loading, setLoading] = useState(false);
  const { setOtpUserId } = useAuthStore();
  const navigate = useNavigate();

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await apiClient.post<{
        data: { userId: string; otpAlreadySent?: boolean; ttlSeconds?: number };
      }>(EP.AUTH_LOGIN, { email, password });

      const { userId, otpAlreadySent, ttlSeconds } = res.data.data;
      setOtpUserId(userId);
      navigate(ROUTES.OTP, { state: { otpAlreadySent: otpAlreadySent ?? false, ttlSeconds: ttlSeconds ?? 300 } });
    } catch (e) {
      toast.error(errMsg(e, 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return { login, loading };
}

export function useVerifyOTP() {
  const [loading, setLoading] = useState(false);
  const { otpUserId, setAuth } = useAuthStore();
  const navigate = useNavigate();

  const verifyOTP = async (otp: string) => {
    if (!otpUserId) {
      toast.error('Session expired. Please login again.');
      navigate(ROUTES.LOGIN);
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post<{ data: { accessToken: string; user: IUserData } }>(
        EP.AUTH_VERIFY_OTP,
        { userId: otpUserId, otp },
      );
      const { accessToken, user } = res.data.data;
      setAuth(user, accessToken);
      navigate(roleHome(user.role));
    } catch (e) {
      toast.error(errMsg(e, 'Invalid OTP. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return { verifyOTP, loading };
}

export function useResendOtp() {
  const [loading, setLoading] = useState(false);
  const { otpUserId } = useAuthStore();

  const resendOtp = async () => {
    if (!otpUserId) return;
    setLoading(true);
    try {
      await apiClient.post(EP.AUTH_RESEND_OTP, { userId: otpUserId });
      toast.success('A new OTP has been sent to your email.');
    } catch (e) {
      toast.error(errMsg(e, 'Failed to resend OTP. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return { resendOtp, loading };
}

export function useForgotPassword() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const forgotPassword = async (email: string) => {
    setLoading(true);
    try {
      const res = await apiClient.post<{ data?: { userId: string } }>(
        EP.AUTH_FORGOT_PASSWORD,
        { email },
      );
      const userId = res.data.data?.userId;
      if (userId) {
        navigate(ROUTES.RESET_PASSWORD, { state: { userId } });
      } else {
        // Generic message even if no account found (security)
        toast.info('If an account exists for that email, you will receive a reset OTP.');
        navigate(ROUTES.LOGIN);
      }
    } catch (e) {
      toast.error(errMsg(e, 'Failed to send reset OTP. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return { forgotPassword, loading };
}

export function useResetPassword() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const resetPassword = async (userId: string, otp: string, newPassword: string) => {
    setLoading(true);
    try {
      await apiClient.post(EP.AUTH_RESET_PASSWORD, { userId, otp, newPassword });
      toast.success('Password reset successfully. Please log in with your new password.');
      navigate(ROUTES.LOGIN);
    } catch (e) {
      toast.error(errMsg(e, 'Failed to reset password. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return { resetPassword, loading };
}

export function useLogout() {
  const { clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const logout = async () => {
    try {
      await apiClient.post(EP.AUTH_LOGOUT);
    } catch {
      // ignore — clear client-side regardless
    } finally {
      clearAuth();
      navigate(ROUTES.LOGIN);
    }
  };

  return { logout };
}
