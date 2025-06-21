import React, { useState, useEffect } from 'react';
import { PostsFeed } from '../components/post/PostsFeed';
import { UserProfile } from '../components/profile/UserProfile';
import { User, Post } from '../types';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';
import { getAllPosts } from '../lib/posts';
import { requestUserLocation, getRadarUsers } from '../lib/location';

interface Props {
  userGender: 'male' | 'female';
}

export const HomeScreen: React.FC<Props> = ({ userGender }) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    loadFilteredPosts();
  }, []);

  const loadFilteredPosts = async () => {
    try {
      console.log('🔍 [HomeScreen] Loading filtered posts...');
      
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        console.error('🔍 [HomeScreen] No authenticated user');
        setPosts([]);
        return;
      }

      // Get user's location for radar filtering
      const locationResult = await requestUserLocation();
      if (!locationResult.success || !locationResult.location) {
        console.log('🔍 [HomeScreen] No location available, showing all posts');
        // If no location, show all posts
        const allPosts = await getAllPosts(50);
        setPosts(allPosts);
        return;
      }

      // Get radar users (users in same location bucket with visibility on)
      const radarResult = await getRadarUsers(user.id, locationResult.location);
      if (!radarResult.success || !radarResult.userIds) {
        console.log('🔍 [HomeScreen] No radar users found');
        setPosts([]);
        return;
      }

      console.log('🔍 [HomeScreen] Radar user IDs:', radarResult.userIds);

      // Get all posts and filter by radar users + visibility
      const allPosts = await getAllPosts(200); // Get more posts to filter from
      
      // Filter posts to only show from radar users with visibility enabled
      const { data: visibleUsers, error: visibilityError } = await supabase
        .from('profiles')
        .select('id')
        .in('id', radarResult.userIds)
        .eq('hide_from_radar', false); // Only users with visibility ON

      if (visibilityError) {
        console.error('🔍 [HomeScreen] Error checking user visibility:', visibilityError);
        setPosts(allPosts); // Fallback to all posts
        return;
      }

      const visibleUserIds = (visibleUsers || []).map(u => u.id);
      console.log('🔍 [HomeScreen] Visible user IDs:', visibleUserIds);

      const filteredPosts = allPosts.filter(post => 
        visibleUserIds.includes(post.userId)
      );

      console.log('🔍 [HomeScreen] Filtered posts count:', filteredPosts.length);
      setPosts(filteredPosts);

    } catch (err) {
      console.error('🔍 [HomeScreen] Error loading posts:', err);
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserClick = async (userId: string) => {
    try {
      console.log('🔍 [HomeScreen] Loading user profile for:', userId);
      
      // Get user profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error || !profile) {
        console.error('🔍 [HomeScreen] Error loading user profile:', error);
        return;
      }

      // Transform database profile to User type
      const transformedUser: User = {
        id: profile.id,
        name: profile.name,
        username: profile.username,
        dpUrl: profile.profile_photo_url || '/images/default-avatar.png',
        bio: profile.bio,
        gender: profile.gender,
        age: profile.date_of_birth ? 
          new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear() : 25,
        distance: Math.floor(Math.random() * 50) + 1,
        links: {
          Twitter: profile.twitter_url || '#',
          Instagram: profile.instagram_url || '#',
          LinkedIn: profile.linked_in_url || '#',
        },
        instagramUrl: profile.instagram_url,
        linkedInUrl: profile.linked_in_url,
        twitterUrl: profile.twitter_url,
      };
      setSelectedUser(transformedUser);
    } catch (error) {
      console.error('🔍 [HomeScreen] Error loading user:', error);
    }
  };

  if (selectedUser) {
    return (
      <div className="min-h-full bg-black">
        <button
          onClick={() => setSelectedUser(null)}
          className="fixed top-4 left-4 z-50 bg-gray-900/80 backdrop-blur-sm p-3 rounded-full shadow-lg active:scale-95 transition-transform"
        >
          <ChevronLeftIcon className="w-5 h-5 text-white" />
        </button>
        <UserProfile user={selectedUser} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-black">
      {/* Header */}
      <div className="bg-black border-b border-gray-800">
        <div className="px-4 py-3 flex items-center">
          <svg className="w-8 h-8 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h1 className="text-xl font-bold text-white">Feed</h1>
        </div>
      </div>

      {/* Posts Feed */}
      <div className="px-4 py-4 space-y-6 pb-20">
        {posts.length > 0 ? (
          <PostsFeed posts={posts} onUserClick={handleUserClick} />
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="text-gray-400 mb-2">No posts from nearby users</p>
            <p className="text-gray-500 text-sm">Posts from people in your area will appear here!</p>
          </div>
        )}
      </div>
    </div>
  );
};