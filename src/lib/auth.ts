import { supabase } from './supabase';
import { transformProfileToUser } from '../../lib/utils';

export interface AuthResult {
  success: boolean;
  error?: string;
  data?: any;
}

export interface ProfileSetupData {
  fullName: string;
  username: string;
  bio: string;
  dateOfBirth: string;
  gender: 'male' | 'female';
  profilePhotoUrl?: string;
}

/**
 * Send OTP for signup process
 */
export const sendSignupOTP = async (email: string): Promise<AuthResult> => {
  try {
    console.log('Sending OTP for signup to:', email);

    if (!supabase) {
      return {
        success: false,
        error: 'Supabase client not available'
      };
    }

    // Use Supabase's signUp method with email confirmation
    const { data, error } = await supabase.auth.signUp({
      email,
      password: 'temp_password_' + Math.random().toString(36), // Temporary password
      options: {
        emailRedirectTo: undefined, // We don't want email redirect
        data: {
          signup_step: 'otp_verification'
        }
      }
    });

    if (error) {
      console.error('Supabase signup error:', error);
      
      // Handle specific error cases
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        return {
          success: false,
          error: 'An account with this email already exists. Please sign in below.'
        };
      }
      
      if (error.message.includes('rate limit')) {
        return {
          success: false,
          error: 'Too many signup attempts. Please wait a moment before trying again.'
        };
      }
      
      return {
        success: false,
        error: error.message
      };
    }

    console.log('OTP sent successfully for new account');
    return {
      success: true,
      data: data
    };

  } catch (error) {
    console.error('Send OTP error:', error);
    return {
      success: false,
      error: 'Network error. Please try again.'
    };
  }
};

/**
 * Verify OTP for signup process
 */
export const verifySignupOTP = async (email: string, token: string): Promise<AuthResult> => {
  try {
    console.log('Verifying OTP for:', email, 'with token:', token);

    if (!supabase) {
      return {
        success: false,
        error: 'Supabase client not available'
      };
    }

    // Verify the OTP token
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup'
    });

    if (error) {
      console.error('OTP verification error:', error);
      return {
        success: false,
        error: error.message || 'Invalid verification code'
      };
    }

    console.log('OTP verified successfully');
    return {
      success: true,
      data: data
    };

  } catch (error) {
    console.error('Verify OTP error:', error);
    return {
      success: false,
      error: 'Network error. Please try again.'
    };
  }
};

/**
 * Set password for authenticated user
 */
export const setUserPassword = async (password: string): Promise<AuthResult> => {
  try {
    console.log('Setting password for authenticated user');

    if (!supabase) {
      return {
        success: false,
        error: 'Supabase client not available'
      };
    }

    // Update the user's password
    const { data, error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      console.error('Password update error:', error);
      return {
        success: false,
        error: error.message || 'Failed to set password'
      };
    }

    console.log('Password set successfully');
    return {
      success: true,
      data: data
    };

  } catch (error) {
    console.error('Set password error:', error);
    return {
      success: false,
      error: 'Network error. Please try again.'
    };
  }
};

/**
 * Sign in with email and password
 */
export const signInWithPassword = async (email: string, password: string): Promise<AuthResult> => {
  try {
    console.log('Signing in with email:', email);

    if (!supabase) {
      return {
        success: false,
        error: 'Supabase client not available'
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Sign in error:', error);
      
      // Handle specific error cases
      if (error.message.includes('Invalid login credentials')) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }
      
      if (error.message.includes('Email not confirmed')) {
        return {
          success: false,
          error: 'Please verify your email address before signing in'
        };
      }
      
      return {
        success: false,
        error: error.message
      };
    }

    console.log('Sign in successful');
    return {
      success: true,
      data: data
    };

  } catch (error) {
    console.error('Sign in error:', error);
    return {
      success: false,
      error: 'Network error. Please try again.'
    };
  }
};

/**
 * Send password reset OTP
 */
export const sendPasswordResetOTP = async (email: string): Promise<AuthResult> => {
  try {
    console.log('Sending password reset OTP to:', email);

    if (!supabase) {
      return {
        success: false,
        error: 'Supabase client not available'
      };
    }

    // Use Supabase's password recovery with OTP
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // Don't create new user for password reset
        data: {
          reset_type: 'password_reset'
        }
      }
    });

    if (error) {
      console.error('Password reset OTP error:', error);
      
      if (error.message.includes('User not found')) {
        return {
          success: false,
          error: 'No account found with this email address'
        };
      }
      
      return {
        success: false,
        error: error.message
      };
    }

    console.log('Password reset OTP sent successfully');
    return {
      success: true,
      data: data
    };

  } catch (error) {
    console.error('Send password reset OTP error:', error);
    return {
      success: false,
      error: 'Network error. Please try again.'
    };
  }
};

/**
 * Verify password reset OTP
 */
export const verifyPasswordResetOTP = async (email: string, token: string): Promise<AuthResult> => {
  try {
    console.log('Verifying password reset OTP for:', email);

    if (!supabase) {
      return {
        success: false,
        error: 'Supabase client not available'
      };
    }

    // Verify the OTP token for password reset
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });

    if (error) {
      console.error('Password reset OTP verification error:', error);
      return {
        success: false,
        error: error.message || 'Invalid verification code'
      };
    }

    console.log('Password reset OTP verified successfully');
    return {
      success: true,
      data: data
    };

  } catch (error) {
    console.error('Verify password reset OTP error:', error);
    return {
      success: false,
      error: 'Network error. Please try again.'
    };
  }
};

/**
 * Reset password for authenticated user (after OTP verification)
 */
export const resetPassword = async (newPassword: string): Promise<AuthResult> => {
  try {
    console.log('Resetting password for authenticated user');

    if (!supabase) {
      return {
        success: false,
        error: 'Supabase client not available'
      };
    }

    // Update the user's password
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      console.error('Password reset error:', error);
      return {
        success: false,
        error: error.message || 'Failed to reset password'
      };
    }

    console.log('Password reset successfully');
    return {
      success: true,
      data: data
    };

  } catch (error) {
    console.error('Reset password error:', error);
    return {
      success: false,
      error: 'Network error. Please try again.'
    };
  }
};

/**
 * Handle refresh token errors
 */
export const handleRefreshTokenError = async (): Promise<void> => {
  try {
    console.log('Handling refresh token error - signing out user');

    if (supabase) {
      await supabase.auth.signOut();
    }
    
    // Clear any local storage or session data if needed
    if (typeof window !== 'undefined') {
      localStorage.removeItem('supabase.auth.token');
    }

  } catch (error) {
    console.error('Error handling refresh token error:', error);
  }
};

/**
 * Complete profile setup for authenticated user
 */
export const completeProfileSetup = async (profileData: ProfileSetupData): Promise<AuthResult> => {
  try {
    console.log('Completing profile setup:', profileData);

    if (!supabase) {
      return {
        success: false,
        error: 'Supabase client not available'
      };
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: 'User not authenticated'
      };
    }

    // Create or update profile - FIXED: Changed avatar_url to profile_photo_url
    const profilePayload = {
      id: user.id,
      name: profileData.fullName,
      username: profileData.username,
      bio: profileData.bio,
      date_of_birth: profileData.dateOfBirth,
      gender: profileData.gender,
      profile_photo_url: profileData.profilePhotoUrl || null, // FIXED: Correct column name
      email: user.email, // FIXED: Include email from auth user
      profile_completed: true,
      updated_at: new Date().toISOString()
    };

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert(profilePayload)
      .select()
      .single();

    if (profileError) {
      console.error('Profile creation error:', profileError);
      return {
        success: false,
        error: profileError.message || 'Failed to create profile'
      };
    }

    console.log('Profile setup completed successfully');
    
    // Transform profile data to user format if needed
    let userData = profile;
    if (typeof transformProfileToUser === 'function') {
      try {
        userData = transformProfileToUser(profile);
      } catch (transformError) {
        console.warn('Profile transformation failed, using raw profile data:', transformError);
      }
    }

    return {
      success: true,
      data: userData
    };

  } catch (error) {
    console.error('Complete profile setup error:', error);
    return {
      success: false,
      error: 'Network error. Please try again.'
    };
  }
};

/**
 * Send password reset email (alternative method)
 */
export const sendPasswordResetEmail = async (email: string): Promise<AuthResult> => {
  try {
    console.log('Sending password reset email to:', email);

    if (!supabase) {
      return {
        success: false,
        error: 'Supabase client not available'
      };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });

    if (error) {
      console.error('Password reset error:', error);
      return {
        success: false,
        error: error.message
      };
    }

    console.log('Password reset email sent successfully');
    return {
      success: true
    };

  } catch (error) {
    console.error('Send password reset error:', error);
    return {
      success: false,
      error: 'Network error. Please try again.'
    };
  }
};

/**
 * Update user password with reset token
 */
export const updatePasswordWithToken = async (accessToken: string, refreshToken: string, newPassword: string): Promise<AuthResult> => {
  try {
    console.log('Updating password with reset token');

    if (!supabase) {
      return {
        success: false,
        error: 'Supabase client not available'
      };
    }

    // Set the session with the tokens from the reset link
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (sessionError) {
      console.error('Session error:', sessionError);
      return {
        success: false,
        error: 'Invalid or expired reset link'
      };
    }

    // Update the password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      console.error('Password update error:', updateError);
      return {
        success: false,
        error: updateError.message
      };
    }

    console.log('Password updated successfully');
    return {
      success: true
    };

  } catch (error) {
    console.error('Update password error:', error);
    return {
      success: false,
      error: 'Network error. Please try again.'
    };
  }
};

/**
 * Check if email exists in the system
 */
export const checkEmailExists = async (email: string): Promise<{ exists: boolean; error?: string }> => {
  try {
    console.log('Checking if email exists:', email);

    if (!supabase) {
      return { exists: false, error: 'Supabase client not available' };
    }

    // Try to sign in with a dummy password to check if user exists
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: 'dummy_check_' + Math.random()
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        // User doesn't exist
        return { exists: false };
      } else {
        // User exists (wrong password, email not confirmed, etc.)
        return { exists: true };
      }
    }

    // If no error, user exists and password was correct (unlikely with random password)
    return { exists: true };

  } catch (error) {
    console.error('Error checking email:', error);
    return { exists: false, error: 'Network error' };
  }
};