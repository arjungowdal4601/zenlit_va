'use client'
import { useState, useEffect } from 'react';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { ProfileSetupScreen } from './screens/ProfileSetupScreen';
import { HomeScreen } from './screens/HomeScreen';
import { RadarScreen } from './screens/RadarScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { CreatePostScreen } from './screens/CreatePostScreen';
import { MessagesScreen } from './screens/MessagesScreen';
import { EditProfileScreen } from './screens/EditProfileScreen';
import { PasswordResetScreen } from './screens/PasswordResetScreen';
import { UserGroupIcon, Squares2X2Icon, UserIcon, PlusIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import { User } from './types';
import { supabase, onAuthStateChange, ensureSession } from './lib/supabase';
import { handleRefreshTokenError } from './lib/auth';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'welcome' | 'login' | 'profileSetup' | 'passwordReset' | 'app'>('welcome');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userGender] = useState<'male' | 'female'>('male');
  const [activeTab, setActiveTab] = useState('radar');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedChatUser, setSelectedChatUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [hideBottomNav, setHideBottomNav] = useState(false);
  const [editProfileSection, setEditProfileSection] = useState<string | undefined>(undefined);
  const [isPasswordResetFlow, setIsPasswordResetFlow] = useState(false);

  // Ensure we're on the client side before doing anything
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Check for password reset recovery flow on app load
  useEffect(() => {
    if (isClient) {
      checkForPasswordResetFlow();
    }
  }, [isClient]);

  const checkForPasswordResetFlow = () => {
    try {
      const url = new URL(window.location.href);
      const type = url.searchParams.get('type');
      const accessToken = url.searchParams.get('access_token');
      const refreshToken = url.searchParams.get('refresh_token');

      console.log('🔍 Checking for password reset flow:', { type, hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken });

      if (type === 'recovery' && accessToken && refreshToken) {
        console.log('🔄 Password reset recovery flow detected, setting flag and showing password reset screen');
        setIsPasswordResetFlow(true);
        setCurrentScreen('passwordReset');
        setIsLoading(false);
        return true;
      }
    } catch (error) {
      console.error('Error checking password reset flow:', error);
    }
    return false;
  };

  // Set up auth state listener
  useEffect(() => {
    if (!isClient) return;

    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.id, 'isPasswordResetFlow:', isPasswordResetFlow);
      
      // Don't process auth changes during password reset flow
      if (isPasswordResetFlow) {
        console.log('🔄 Ignoring auth state change during password reset flow');
        return;
      }
      
      if (event === 'SIGNED_IN' && session) {
        console.log('User signed in, checking profile...');
        await handleAuthenticatedUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
        handleSignOut();
      } else if (event === 'TOKEN_REFRESHED' && session) {
        console.log('Token refreshed successfully');
      } else if (event === 'TOKEN_REFRESH_FAILED') {
        console.error('Token refresh failed');
        await handleRefreshTokenError();
      }
    });

    return () => subscription.unsubscribe();
  }, [isClient, isPasswordResetFlow]);

  // Check authentication status on app load
  useEffect(() => {
    if (isClient && !isPasswordResetFlow) {
      checkAuthStatus();
    }
  }, [isClient, isPasswordResetFlow]);

  const checkAuthStatus = async () => {
    try {
      if (!supabase) {
        console.warn('Supabase not available, using offline mode');
        setCurrentScreen('welcome');
        setIsLoading(false);
        return;
      }

      console.log('Checking authentication status...');

      const sessionResult = await ensureSession();
      
      if (!sessionResult.success) {
        console.log('No valid session found:', sessionResult.error);
        setCurrentScreen('welcome');
        setIsLoading(false);
        return;
      }

      try {
        const { data: sessionData, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Session fetch error:', error);
          setCurrentScreen('welcome');
          setIsLoading(false);
          return;
        }
        
        if (!sessionData.session) {
          console.log('No active session found');
          setCurrentScreen('welcome');
          setIsLoading(false);
          return;
        }

        const user = sessionData.session.user;
        console.log('Valid session found for user:', user.id);

        await handleAuthenticatedUser(user);
      } catch (networkError) {
        console.error('Network error during session check:', networkError);
        setCurrentScreen('welcome');
        setIsLoading(false);
        return;
      }
      
    } catch (error) {
      console.error('Auth check error:', error);
      setCurrentScreen('welcome');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthenticatedUser = async (user: any) => {
    try {
      console.log('Handling authenticated user:', user.id);

      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          if (profileError.code === 'PGRST116') {
            console.log('No profile found, redirecting to profile setup');
            setCurrentScreen('profileSetup');
            return;
          } else {
            console.error('Profile fetch error:', profileError);
            setCurrentScreen('profileSetup');
            return;
          }
        }

        if (!profile) {
          console.log('No profile found, redirecting to profile setup');
          setCurrentScreen('profileSetup');
          return;
        }

        console.log('Profile found:', profile);
        setCurrentUser(profile);
        setIsLoggedIn(true);

        const isProfileComplete = profile.name && 
                                 profile.bio && 
                                 profile.date_of_birth && 
                                 profile.gender &&
                                 profile.username;

        if (isProfileComplete) {
          setCurrentScreen('app');
        } else {
          setCurrentScreen('profileSetup');
        }
      } catch (networkError) {
        console.error('Network error fetching profile:', networkError);
        setCurrentScreen('profileSetup');
        return;
      }
    } catch (error) {
      console.error('Error handling authenticated user:', error);
      setCurrentScreen('profileSetup');
    }
  };

  const handleLogin = async () => {
    console.log('Login successful, checking user state...');
    setIsLoggedIn(true);
    await new Promise(resolve => setTimeout(resolve, 500));
  };

  const handleProfileSetupComplete = (profileData: any) => {
    console.log('Profile setup completed:', profileData);
    setCurrentUser(profileData);
    setCurrentScreen('app');
  };

  const handleSignOut = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCurrentScreen('welcome');
    setActiveTab('radar');
    setSelectedUser(null);
    setSelectedChatUser(null);
    setHideBottomNav(false);
    setIsPasswordResetFlow(false); // Reset password reset flow flag
  };

  const handleLogout = async () => {
    try {
      if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error('Logout error:', error);
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
      handleSignOut();
    }
  };

  const handlePasswordResetComplete = () => {
    console.log('Password reset completed, returning to login');
    setIsPasswordResetFlow(false); // Clear the password reset flow flag
    setCurrentScreen('login');
    
    // Clear URL parameters
    try {
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      console.error('Error clearing URL parameters:', error);
    }
  };

  const handleMessageUser = (user: User) => {
    console.log('🔍 [App] handleMessageUser called with user:', user.id);
    setSelectedChatUser(user);
    setHideBottomNav(true);
  };

  const handleViewProfile = (user: User) => {
    console.log('🔍 [App] handleViewProfile called with user:', user.id);
    setSelectedUser(user);
    setActiveTab('profile');
  };

  const handleNavigateToCreate = () => {
    setActiveTab('create');
  };

  const handleNavigateToEdit = (section?: string) => {
    console.log('🔍 [App] handleNavigateToEdit called with section:', section);
    setEditProfileSection(section);
    setActiveTab('editProfile');
  };

  const handleTabChange = (tab: string) => {
    console.log('🔍 [App] handleTabChange called with tab:', tab);
    setActiveTab(tab);
    setHideBottomNav(false);
    setSelectedChatUser(null);
    setSelectedUser(null);
    setEditProfileSection(undefined);
  };

  const handleBackFromChat = () => {
    setSelectedChatUser(null);
    setHideBottomNav(false);
  };

  const handleBackFromEdit = () => {
    setActiveTab('profile');
    setEditProfileSection(undefined);
  };

  const handleSaveProfile = (updatedUser: any) => {
    console.log('🔍 [App] handleSaveProfile called with:', updatedUser);
    setCurrentUser(updatedUser);
    setActiveTab('profile');
    setEditProfileSection(undefined);
  };

  // Don't render anything until we're on the client
  if (!isClient) {
    return null;
  }

  // Show loading screen while checking auth (but not during password reset flow)
  if (isLoading && !isPasswordResetFlow) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show password reset screen if in recovery flow
  if (currentScreen === 'passwordReset') {
    return <PasswordResetScreen onBack={handlePasswordResetComplete} />;
  }

  // Show welcome screen first
  if (currentScreen === 'welcome') {
    return <WelcomeScreen onGetStarted={() => setCurrentScreen('login')} />;
  }

  // Show login screen after get started is clicked
  if (currentScreen === 'login') {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Show profile setup screen for new users
  if (currentScreen === 'profileSetup') {
    return (
      <ProfileSetupScreen 
        onComplete={handleProfileSetupComplete}
        onBack={() => setCurrentScreen('login')}
      />
    );
  }

  // Show main app after login and profile setup
  return (
    <div className="h-screen bg-black text-white overflow-hidden flex flex-col mobile-container">
      <div className="flex-1 flex flex-col min-h-0">
        <main className="flex-1 overflow-hidden relative content-with-nav">
          <div className="h-full">
            {activeTab === 'radar' && (
              <div className="h-full overflow-y-auto mobile-scroll">
                <RadarScreen 
                  userGender={userGender} 
                  onNavigate={handleTabChange}
                  onViewProfile={handleViewProfile}
                  onMessageUser={handleMessageUser}
                />
              </div>
            )}
            {activeTab === 'feed' && (
              <div className="h-full overflow-y-auto mobile-scroll">
                <HomeScreen userGender={userGender} />
              </div>
            )}
            {activeTab === 'create' && (
              <div className="h-full overflow-y-auto mobile-scroll">
                <CreatePostScreen />
              </div>
            )}
            {activeTab === 'messages' && (
              <div className="h-full">
                <MessagesScreen 
                  selectedUser={selectedChatUser}
                  onClearSelectedUser={handleBackFromChat}
                  onViewProfile={handleViewProfile}
                  onHideBottomNav={setHideBottomNav}
                />
              </div>
            )}
            {activeTab === 'profile' && (
              <div className="h-full overflow-y-auto mobile-scroll">
                <ProfileScreen 
                  user={selectedUser} 
                  currentUser={currentUser}
                  onBack={() => {
                    setSelectedUser(null);
                    setActiveTab('radar');
                  }}
                  onLogout={handleLogout}
                  onNavigateToCreate={handleNavigateToCreate}
                  onNavigateToEdit={handleNavigateToEdit}
                />
              </div>
            )}
            {activeTab === 'editProfile' && (
              <div className="h-full overflow-y-auto mobile-scroll">
                <EditProfileScreen
                  user={currentUser}
                  onBack={handleBackFromEdit}
                  onSave={handleSaveProfile}
                  initialSection={editProfileSection}
                />
              </div>
            )}
          </div>
        </main>

        {!hideBottomNav && (
          <nav className="bg-gray-900 border-t border-gray-800 flex-shrink-0 bottom-nav">
            <div className="flex justify-around items-center py-2 px-4 h-16">
              <button
                onClick={() => handleTabChange('radar')}
                className={`nav-button-mobile flex flex-col items-center justify-center p-2 rounded-lg transition-colors ${
                  activeTab === 'radar' ? 'text-blue-500' : 'text-gray-400'
                }`}
              >
                <UserGroupIcon className="h-6 w-6 mb-1" />
                <span className="text-xs font-medium">Radar</span>
              </button>
              
              <button
                onClick={() => handleTabChange('feed')}
                className={`nav-button-mobile flex flex-col items-center justify-center p-2 rounded-lg transition-colors ${
                  activeTab === 'feed' ? 'text-blue-500' : 'text-gray-400'
                }`}
              >
                <Squares2X2Icon className="h-6 w-6 mb-1" />
                <span className="text-xs font-medium">Feed</span>
              </button>

              <button
                onClick={() => handleTabChange('create')}
                className={`nav-button-mobile flex flex-col items-center justify-center p-2 rounded-lg transition-colors ${
                  activeTab === 'create' ? 'text-blue-500' : 'text-gray-400'
                }`}
              >
                <PlusIcon className="h-6 w-6 mb-1" />
                <span className="text-xs font-medium">Create</span>
              </button>

              <button
                onClick={() => handleTabChange('messages')}
                className={`nav-button-mobile flex flex-col items-center justify-center p-2 rounded-lg transition-colors ${
                  activeTab === 'messages' ? 'text-blue-500' : 'text-gray-400'
                }`}
              >
                <ChatBubbleLeftIcon className="h-6 w-6 mb-1" />
                <span className="text-xs font-medium">Messages</span>
              </button>
              
              <button
                onClick={() => handleTabChange('profile')}
                className={`nav-button-mobile flex flex-col items-center justify-center p-2 rounded-lg transition-colors ${
                  activeTab === 'profile' ? 'text-blue-500' : 'text-gray-400'
                }`}
              >
                <UserIcon className="h-6 w-6 mb-1" />
                <span className="text-xs font-medium">Profile</span>
              </button>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}