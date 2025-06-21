import React from 'react';
import { User } from '../../types';
import { Avatar } from '../common/Avatar';
import { IconBrandInstagram, IconBrandLinkedin, IconBrandX } from '@tabler/icons-react';

interface Props {
  user: User;
  posts?: any[]; // Accept real posts from props
  isOwnProfile?: boolean; // New prop to determine if viewing own profile
}

export const UserProfile: React.FC<Props> = ({ user, posts = [], isOwnProfile = false }) => {
  // Helper function to check if a URL is valid and not a placeholder
  const isValidUrl = (url: string | undefined | null): boolean => {
    return !!(url && url.trim() !== '' && url !== '#');
  };

  // Get social links based on profile type
  const getSocialLinks = () => {
    const links = [
      { url: user.twitterUrl, Icon: IconBrandX, title: 'X (Twitter)' },
      { url: user.instagramUrl, Icon: IconBrandInstagram, title: 'Instagram' },
      { url: user.linkedInUrl, Icon: IconBrandLinkedin, title: 'LinkedIn' }
    ];

    if (isOwnProfile) {
      // For own profile: show all icons, green if active, grey if inactive
      return links.map(({ url, Icon, title }) => {
        const isActive = isValidUrl(url);
        return (
          <div key={title} className="relative">
            {isActive ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-500 hover:text-green-400 transition-colors"
                title={title}
              >
                <Icon size={24} />
              </a>
            ) : (
              <div
                className="text-gray-400 cursor-default pointer-events-none"
                title="Not added"
              >
                <Icon size={24} />
              </div>
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
            className="text-green-500 hover:text-green-400 transition-colors"
            title={title}
          >
            <Icon size={24} />
          </a>
        ));
    }
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Cover Image */}
      <div className="relative h-48 bg-gradient-to-b from-blue-900 to-black">
        <img
          src={user.coverPhotoUrl || "/images/default-cover.jpg"}
          alt="Cover"
          className="w-full h-full object-cover opacity-50"
        />
      </div>

      {/* Profile Info */}
      <div className="relative px-4 pb-4">
        <div className="flex flex-col items-center -mt-16">
          <Avatar
            src={user.dpUrl || '/images/default-avatar.png'}
            alt={user.name}
            size="lg"
          />
          <h1 className="text-2xl font-bold mt-4">{user.name}</h1>
          {user.username && (
            <p className="text-gray-400 mt-1">@{user.username}</p>
          )}
          <p className="text-gray-400 mt-2">{user.bio}</p>
          
          {/* Social Links */}
          <div className="mt-6 flex gap-6">
            {getSocialLinks()}
          </div>
        </div>

        {/* Posts Grid */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Posts</h2>
          {posts.length > 0 ? (
            <div className="grid grid-cols-3 gap-1">
              {posts.map((post) => (
                <div key={post.id} className="aspect-square relative group">
                  <img
                    src={post.mediaUrl}
                    alt={post.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 flex items-center justify-center">
                    <p className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white text-sm text-center px-2">
                      {post.caption}
                    </p>
                  </div>
                </div>
              ))}
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