import React, { useState } from 'react';
import { ChevronLeftIcon, CheckCircleIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

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
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSendResetCode = async () => {
    if (!formData.email) {
      alert('Please enter your email address');
      return;
    }

    setIsLoading(true);
    
    // Simulate sending reset code
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsLoading(false);
    setStep('otp');
    setCountdown(60);

    // Start countdown timer
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleVerifyOtp = async () => {
    if (!formData.otp || formData.otp.length !== 6) {
      alert('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);
    
    // Simulate OTP verification
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsLoading(false);
    setStep('newPassword');
  };

  const handleResetPassword = async () => {
    if (!formData.newPassword || formData.newPassword.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    setIsLoading(true);
    
    // Simulate password reset
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsLoading(false);
    setStep('success');
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    
    // Simulate resending code
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsLoading(false);
    setCountdown(60);

    // Start countdown timer
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
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
        onClick={handleSendResetCode}
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
  );

  const renderNewPasswordStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Create New Password</h2>
        <p className="text-gray-400">
          Choose a strong password for your account
        </p>
      </div>

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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">Password must be at least 6 characters</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Confirm New Password
        </label>
        <input
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Confirm new password"
          required
          minLength={6}
        />
      </div>

      <button
        onClick={handleResetPassword}
        disabled={isLoading || !formData.newPassword || !formData.confirmPassword}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 active:scale-95 transition-all disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Resetting Password...
          </>
          ) : (
            "Reset Password"
          )}
      </button>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="space-y-6 text-center">
      <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
        <CheckCircleIcon className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Password Reset Successful!</h2>
      <p className="text-gray-400 mb-6">
        Your password has been successfully reset. You can now sign in with your new password.
      </p>
      
      <button
        onClick={onBack}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 active:scale-95 transition-all"
      >
        Back to Sign In
      </button>
    </div>
  );

  return (
    <div className="min-h-screen min-h-[100dvh] bg-black overflow-y-auto mobile-scroll">
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="flex items-center mb-6">
            <button
              onClick={onBack}
              className="mr-4 p-2 rounded-full hover:bg-gray-800 active:scale-95 transition-all"
            >
              <ChevronLeftIcon className="w-5 h-5 text-white" />
            </button>
            <div className="flex items-center">
              <img
                src="https://udixrkvcyrxmmrbadhpj.supabase.co/storage/v1/object/public/app-images//Picture1.png"
                alt="Zenlit"
                className="w-8 h-8 object-contain rounded mr-3"
              />
              <h1 className="text-xl font-bold text-white">Zenlit</h1>
            </div>
          </div>

          {/* Form Container */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            {step === 'email' && renderEmailStep()}
            {step === 'otp' && renderOtpStep()}
            {step === 'newPassword' && renderNewPasswordStep()}
            {step === 'success' && renderSuccessStep()}
          </div>

          {/* Help Text */}
          {step !== 'success' && (
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