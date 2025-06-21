import React, { useState, useEffect } from 'react';
import { User, Post } from '../types';
import { IconBrandInstagram, IconBrandLinkedin, IconBrandX } from '@tabler/icons-react';
import { ChevronLeftIcon, Cog6ToothIcon, UserIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { PostsGalleryScreen } from './PostsGalleryScreen';
import { EditProfileScreen } from './EditProfileScreen';
import { supabase } from '../lib/supabase';
import { getUserPosts } from '../lib/posts';

interface Props {
  user?: User | null;
  currentUser?: any;
  onBack?: () => void;
  onLogout?: () => void;
  onNavigateToCreate?: () => void;
  onNavigateToEdit?: (section?: string) => void; // New prop for edit navigation
}

export const ProfileScreen: React.FC<Props> = ({ 
  user, 
  currentUser, 
  onBack, 
  onLogout, 
  onNavigateToCreate,
  onNavigateToEdit
}) => {
  const [showPostsGallery, setShowPostsGallery] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  
  // Determine if viewing own profile or another user's profile
  const isCurrentUser = !user || (currentUser && user?.id === currentUser.id);
  
  // Use current user data if viewing own profile, otherwise use passed user
  const displayUser = isCurrentUser ? currentUser : user;

  // Load profile data when component mounts or user changes
  useEffect(() => {
    if (displayUser) {
      setProfileData(displayUser);
      loadUserPosts(displayUser.id);
    } else if (isCurrentUser && currentUser) {
      setProfileData(currentUser);
      loadUserPosts(currentUser.id);
    } else {
      // Load current user profile from database
      loadCurrentUserProfile();
    }
  }, [displayUser, currentUser, isCurrentUser]);

  const loadUserPosts = async (userId: string) => {
    try {
      console.log('🔍 [ProfileScreen] Loading posts for user:', userId);
      
      // Use getUserPosts for any user (current or other users)
      const posts = await getUserPosts(userId);
      console.log('🔍 [ProfileScreen] Loaded posts:', posts);
      setUserPosts(posts);
    } catch (error) {
      console.error('🔍 [ProfileScreen] Load user posts error:', error);
      setUserPosts([]);
    }
  };

  const loadCurrentUserProfile = async () => {
    if (!isCurrentUser) return;
    
    setIsLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('User fetch error:', userError);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Profile fetch error:', profileError);
        return;
      }

      // If no profile exists, create one
      if (!profile) {
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'New User',
            email: user.email,
            bio: 'New to Zenlit! 👋',
            created_at: new Date().toISOString()
          })
          .select()
          .maybeSingle();

        if (createError) {
          console.error('Profile creation error:', createError);
          return;
        }

        setProfileData(newProfile);
        if (newProfile) {
          loadUserPosts(newProfile.id);
        }
      } else {
        setProfileData(profile);
        loadUserPosts(profile.id);
      }
    } catch (error) {
      console.error('Load profile error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMediaClick = () => {
    setShowPostsGallery(true);
  };

  const handleBackFromGallery = () => {
    setShowPostsGallery(false);
  };

  const handleEditProfile = (section?: string) => {
    setShowSettingsMenu(false);
    if (onNavigateToEdit) {
      onNavigateToEdit(section);
    } else {
      setShowEditProfile(true);
    }
  };

  const handleBackFromEdit = () => {
    setShowEditProfile(false);
  };

  const handleSaveProfile = async (updatedProfile: any) => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not found');
      }

      const { data: savedProfile, error: updateError } = await supabase
        .from('profiles')
          .update({
            name: updatedProfile.name,
            bio: updatedProfile.bio,
            profile_photo_url: updatedProfile.dpUrl,
            cover_photo_url: updatedProfile.coverPhotoUrl,
            updated_at: new Date().toISOString()
          })
        .eq('id', user.id)
        .select()
        .maybeSingle();

      if (updateError) {
        throw updateError;
      }

      if (!savedProfile) {
        throw new Error('Profile not found for update');
      }

      // Update local state
      setProfileData(savedProfile);
      setShowEditProfile(false);
      
    } catch (error) {
      console.error('Save profile error:', error);
      alert('Failed to save profile. Please try again.');
    }
  };

  const handleLogout = () => {
    setShowSettingsMenu(false);
    if (confirm('Are you sure you want to log out?')) {
      if (onLogout) {
        onLogout();
      }
    }
  };

  const handleCreatePost = () => {
    if (onNavigateToCreate) {
      onNavigateToCreate();
    }
  };

  const handlePostDeleted = (postId: string) => {
    // Remove the deleted post from the local state
    setUserPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
  };

  // Helper function to check if a URL is valid and not a placeholder
  const isValidUrl = (url: string | undefined | null): boolean => {
    return !!(url && url.trim() !== '' && url !== '#');
  };

  // Handle social icon click for own profile
  const handleSocialIconClick = (platform: string, url?: string) => {
    if (isCurrentUser && !isValidUrl(url)) {
      // Navigate to edit profile with specific section
      handleEditProfile(platform);
    }
  };

  // Get social links based on profile type
  const getSocialLinks = () => {
    const links = [
      { url: profileData?.twitter_url, Icon: IconBrandX, title: 'X (Twitter)', platform: 'twitter' },
      { url: profileData?.instagram_url, Icon: IconBrandInstagram, title: 'Instagram', platform: 'instagram' },
      { url: profileData?.linked_in_url, Icon: IconBrandLinkedin, title: 'LinkedIn', platform: 'linkedin' }
    ];

    if (isCurrentUser) {
      // For own profile: show all icons, green if active, grey if inactive and clickable
      return links.map(({ url, Icon, title, platform }) => {
        const isActive = isValidUrl(url);
        return (
          <div key={title} className="relative">
            {isActive ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-gray-800 rounded-full text-green-500 hover:text-green-400 hover:bg-gray-700 transition-all active:scale-95"
                title={title}
              >
                <Icon size={24} />
              </a>
            ) : (
              <button
                onClick={() => handleSocialIconClick(platform, url)}
                className="p-3 bg-gray-800 rounded-full text-gray-400 hover:text-gray-300 hover:bg-gray-700 transition-all active:scale-95 cursor-pointer"
                title={`Add ${title}`}
              >
                <Icon size={24} />
              </button>
            )}
          </div>
        );
      });
    } else {
      // For other profiles: only show active (green) icons
      return links
        .filter(({ url }) => isValidUrl(url))
        .map(({ url, Icon, title }) => (
          <a
            key={title}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 bg-gray-800 rounded-full text-green-500 hover:text-green-400 hover:bg-gray-700 transition-all active:scale-95"
            title={title}
          >
            <Icon size={24} />
          </a>
        ));
    }
  };

  // Show loading state
  if (isLoading || !profileData) {
    return (
      <div className="min-h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (showEditProfile) {
    return (
      <EditProfileScreen
        user={profileData}
        onBack={handleBackFromEdit}
        onSave={handleSaveProfile}
      />
    );
  }

  if (showPostsGallery) {
    return (
      <PostsGalleryScreen
        user={profileData}
        posts={userPosts}
        onBack={handleBackFromGallery}
        onUserClick={() => {}} // Since we're already viewing this user's profile
        onPostDeleted={handlePostDeleted}
      />
    );
  }

  return (
    <div className="min-h-full bg-black">
      {/* Profile Header with Cover Photo */}
      <div className="relative">
        <div className="h-48 bg-gray-800">
          {profileData.cover_photo_url ? (
            <img
              src={profileData.cover_photo_url}
              alt="Profile Cover"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900" />
          )}
          
          {/* Header buttons positioned on cover photo */}
          <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4">
            {/* Back button (only for other users) */}
            {user && onBack && (
              <button
                onClick={onBack}
                className="bg-black/50 backdrop-blur-sm p-3 rounded-full shadow-lg active:scale-95 transition-transform"
              >
                <ChevronLeftIcon className="w-5 h-5 text-white" />
              </button>
            )}
            
            {/* Spacer for centering when no back button */}
            {(!user || !onBack) && <div className="w-12" />}
            
            {/* Settings button (only for current user) */}
            {isCurrentUser && (
              <div className="relative">
                <button
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                  className="bg-black/50 backdrop-blur-sm p-3 rounded-full shadow-lg active:scale-95 transition-transform"
                >
                  <Cog6ToothIcon className="w-5 h-5 text-white" />
                </button>
                
                {/* Settings Dropdown Menu */}
                {showSettingsMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
                    <button
                      onClick={() => handleEditProfile()}
                      className="w-full flex items-center px-4 py-3 text-left text-white hover:bg-gray-800 active:bg-gray-700 transition-colors"
                    >
                      <UserIcon className="w-5 h-5 mr-3 text-gray-400" />
                      <span>Edit Profile</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center px-4 py-3 text-left text-white hover:bg-gray-800 active:bg-gray-700 transition-colors"
                    >
                      <ArrowRightOnRectangleIcon className="w-5 h-5 mr-3 text-gray-400" />
                      <span>Log Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* Spacer when viewing other user's profile */}
            {!isCurrentUser && <div className="w-12" />}
          </div>
        </div>
        
        {/* Profile Avatar */}
        <div className="absolute left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="relative">
            {profileData.profile_photo_url ? (
              <img
                src={profileData.profile_photo_url}
                alt={profileData.name}
                className="w-28 h-28 rounded-full border-4 border-black object-cover shadow-xl"
              />
            ) : (
              <div className="w-28 h-28 rounded-full border-4 border-black bg-gray-700 flex items-center justify-center shadow-xl">
                <UserIcon className="w-12 h-12 text-gray-400" />
              </div>
            )}
          </div>
        </div>
        
        {/* Click outside to close settings menu */}
        {showSettingsMenu && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowSettingsMenu(false)}
          />
        )}
      </div>

      {/* Profile Content */}
      <div className="mt-16 px-4 pb-20">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">{profileData.name}</h1>
          
          <p className="text-gray-300 mt-2 text-base leading-relaxed">
            {profileData.bio || 'No bio available'}
          </p>
          
          {/* Social Links */}
          <div className="flex justify-center gap-4 mt-8">
            {getSocialLinks()}
          </div>
        </div>
        
        {/* Posts Section */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">
              {isCurrentUser ? 'My Posts' : 'Posts'}
            </h2>
            {userPosts.length > 0 && (
              <span className="text-sm text-gray-400">
                {userPosts.length} post{userPosts.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          {/* Posts Grid */}
          {userPosts.length > 0 ? (
            <div className="grid grid-cols-3 gap-1">
              {userPosts.slice(0, 9).map((post) => (
                <button
                  key={post.id}
                  onClick={handleMediaClick}
                  className="aspect-square active:scale-95 transition-transform relative group"
                >
                  <img
                    src={post.mediaUrl}
                    alt={post.caption}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 rounded-lg" />
                </button>
              ))}
            </div>
          ) : isCurrentUser ? (
            <div className="text-center py-12">
              <button
                onClick={handleCreatePost}
                className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 hover:bg-gray-700 active:scale-95 transition-all cursor-pointer"
              >
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <p className="text-gray-400 mb-2">No posts yet</p>
              <p className="text-gray-500 text-sm">Share your first post to get started!</p>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-400 mb-2">No posts yet</p>
              <p className="text-gray-500 text-sm">Posts will appear here when shared</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};