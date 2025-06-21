import React, { useState, useEffect } from 'react';
import { ChevronLeftIcon, CheckCircleIcon, EnvelopeIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { sendPasswordResetOTP, verifyPasswordResetOTP, resetPassword } from '../lib/auth';
import { supabase } from '../lib/supabase';

interface Props {
  onBack: () => void;
}

export const PasswordResetScreen: React.FC<Props> = ({ onBack }) => {
  const [step, setStep] = useState<'email' | 'otp' | 'newPassword' | 'success'>('email');
  const [formData, setFormData] = useState({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(false);

  // Check for recovery flow on component mount
  useEffect(() => {
    checkForRecoveryFlow();
  }, []);

  const checkForRecoveryFlow = async () => {
    try {
      // Check URL parameters for recovery flow
      const url = new URL(window.location.href);
      const type = url.searchParams.get('type');
      const accessToken = url.searchParams.get('access_token');
      const refreshToken = url.searchParams.get('refresh_token');

      console.log('🔍 Checking recovery flow:', { type, hasAccessToken: !!accessToken });

      if (type === 'recovery' && accessToken && refreshToken) {
        console.log('🔄 Recovery flow detected, setting session...');
        setIsRecoveryFlow(true);
        
        // Set the session with the tokens from the URL
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (error) {
          console.error('❌ Session setup error:', error);
          setError('Invalid or expired reset link. Please try again.');
          return;
        }

        if (data.session) {
          console.log('✅ Session established, showing password reset form');
          // Clear URL parameters for security
          window.history.replaceState({}, document.title, window.location.pathname);
          // Go directly to new password step
          setStep('newPassword');
        }
      }
    } catch (error) {
      console.error('❌ Recovery flow check error:', error);
      setError('Failed to process reset link. Please try again.');
    }
  };

  // Countdown timer effect for OTP resend
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear errors when user starts typing
    if (error) setError(null);
  };

  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.email) {
      setError('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('Sending password reset OTP to:', formData.email);
      const result = await sendPasswordResetOTP(formData.email);
      
      if (result.success) {
        console.log('Password reset OTP sent successfully');
        setStep('otp');
        setCountdown(60);
      } else {
        console.error('Password reset OTP send failed:', result.error);
        setError(result.error || 'Failed to send reset code');
      }
    } catch (error) {
      console.error('Password reset OTP send error:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);

    if (!formData.otp || formData.otp.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('🔍 DEBUG: Verifying password reset OTP for:', formData.email);
      const result = await verifyPasswordResetOTP(formData.email, formData.otp);
      
      if (result.success) {
        console.log('🔍 DEBUG: OTP verified successfully, moving to password step WITHOUT auto-login');
        // Move to password creation step WITHOUT authenticating
        setStep('newPassword');
      } else {
        console.error('Password reset OTP verification failed:', result.error);
        setError(result.error || 'Invalid verification code');
      }
    } catch (error) {
      console.error('Password reset OTP verification error:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.newPassword || formData.newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('🔄 Updating password...');
      
      // For recovery flow, update password directly
      if (isRecoveryFlow) {
        const { data, error } = await supabase.auth.updateUser({
          password: formData.newPassword
        });

        if (error) {
          console.error('❌ Password update failed:', error);
          setError(error.message || 'Failed to update password');
          return;
        }

        console.log('✅ Password updated successfully via recovery flow');
        
        // Sign out the user after password reset
        await supabase.auth.signOut();
        
        setStep('success');
      } else {
        // For OTP flow, we need to authenticate first then update password
        // This should not happen in the current flow, but keeping for safety
        setError('Invalid password reset flow. Please try again.');
      }

    } catch (error) {
      console.error('❌ Password update error:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;

    setError(null);
    setIsLoading(true);

    try {
      const result = await sendPasswordResetOTP(formData.email);
      
      if (result.success) {
        setCountdown(60);
        // Clear the OTP field
        setFormData(prev => ({ ...prev, otp: '' }));
      } else {
        setError(result.error || 'Failed to resend code');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderEmailStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <EnvelopeIcon className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Reset Password</h2>
        <p className="text-gray-400">
          Enter your email address and we&apos;ll send you a code to reset your password
        </p>
      </div>

      <form onSubmit={handleSendResetCode} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your email address"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !formData.email}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 active:scale-95 transition-all disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Sending Code...
            </>
          ) : (
            "Send Reset Code"
          )}
        </button>
      </form>
    </div>
  );

  const renderOtpStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircleIcon className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Check Your Email</h2>
        <p className="text-gray-400">
          We&apos;ve sent a 6-digit code to <span className="text-white">{formData.email}</span>
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Enter Verification Code
          </label>
          <input
            type="text"
            value={formData.otp}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
              handleInputChange('otp', value);
            }}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center tracking-widest text-lg"
            placeholder="000000"
            maxLength={6}
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter the 6-digit code sent to your email
          </p>
        </div>

        <button
          onClick={handleVerifyOtp}
          disabled={isLoading || formData.otp.length !== 6}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 active:scale-95 transition-all disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify Code"
          )}
        </button>

        <div className="text-center">
          <p className="text-gray-400 text-sm">
            Didn&apos;t receive the code?{' '}
            <button
              onClick={handleResendCode}
              disabled={countdown > 0 || isLoading}
              className="text-blue-400 hover:text-blue-300 transition-colors disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );

  const renderNewPasswordStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Set New Password</h2>
        <p className="text-gray-400">
          Choose a strong password for your account
        </p>
      </div>

      <form onSubmit={handleSetNewPassword} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            New Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={formData.newPassword}
              onChange={(e) => handleInputChange('newPassword', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
              placeholder="Enter new password"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            >
              {showPassword ? (
                <EyeSlashIcon className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Password must be at least 6 characters</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Confirm New Password
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
              placeholder="Confirm new password"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            >
              {showConfirmPassword ? (
                <EyeSlashIcon className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !formData.newPassword || !formData.confirmPassword}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 active:scale-95 transition-all disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Updating Password...
            </>
          ) : (
            "Set New Password"
          )}
        </button>
      </form>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="space-y-6 text-center">
      <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
        <CheckCircleIcon className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Password Updated!</h2>
      <p className="text-gray-400 mb-6">
        Your password has been successfully updated. You can now sign in with your new password.
      </p>
      
      <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
        <p className="text-green-400 text-sm">
          ✅ Password securely updated in your account
        </p>
      </div>
      
      <button
        onClick={onBack}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 active:scale-95 transition-all"
      >
        Continue to Sign In
      </button>
    </div>
  );

  return (
    <div className="min-h-screen min-h-[100dvh] bg-black overflow-y-auto mobile-scroll">
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-md">
          {/* Header */}
          {!isRecoveryFlow && (
            <div className="flex items-center mb-6">
              <button
                onClick={onBack}
                className="mr-4 p-2 rounded-full hover:bg-gray-800 active:scale-95 transition-all"
              >
                <ChevronLeftIcon className="w-5 h-5 text-white" />
              </button>
              <div className="flex items-center">
                <h1 className="text-xl font-bold text-white">Zenlit</h1>
              </div>
            </div>
          )}

          {/* Form Container */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            {/* Error Message */}
            {error && (
              <div className="mb-4 bg-red-900/30 border border-red-700 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Recovery Flow Info */}
            {isRecoveryFlow && step === 'newPassword' && (
              <div className="mb-4 bg-blue-900/30 border border-blue-700 rounded-lg p-3">
                <p className="text-blue-400 text-sm">
                  🔐 Password reset link verified. Please set your new password below.
                </p>
              </div>
            )}

            {step === 'email' && renderEmailStep()}
            {step === 'otp' && renderOtpStep()}
            {step === 'newPassword' && renderNewPasswordStep()}
            {step === 'success' && renderSuccessStep()}
          </div>

          {/* Help Text */}
          {step !== 'success' && !isRecoveryFlow && (
            <div className="mt-6 text-center pb-8">
              <p className="text-xs text-gray-500">
                Remember your password?{' '}
                <button
                  onClick={onBack}
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Back to Sign In
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};