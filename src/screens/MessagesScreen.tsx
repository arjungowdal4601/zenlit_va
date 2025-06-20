import { useState, useEffect, useMemo } from 'react';
import { ChatList } from '../components/messaging/ChatList';
import { ChatWindow } from '../components/messaging/ChatWindow';
import { User, Message } from '../types';
import { supabase } from '../lib/supabase';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Props {
  selectedUser?: (User & { isNearby?: boolean }) | null;
  onClearSelectedUser?: () => void;
  onViewProfile?: (user: User) => void;
}

export const MessagesScreen: React.FC<Props> = ({ 
  selectedUser: initialSelectedUser, 
  onClearSelectedUser,
  onViewProfile
}) => {
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<(User & { isNearby?: boolean }) | undefined>(initialSelectedUser || undefined);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMobile] = useState(window.innerWidth < 768);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUsersAndMessages();
  }, []);

  useEffect(() => {
    if (initialSelectedUser) {
      setSelectedUser(initialSelectedUser);
    }
  }, [initialSelectedUser]);

  const loadUsersAndMessages = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) return;

      setCurrentUserId(currentUser.id);

      // Get users who have completed their profiles for messaging
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', currentUser.id) // Exclude current user
        .not('name', 'is', null)
        .not('bio', 'is', null)
        .limit(50);

      if (error) {
        console.error('Error loading users:', error);
        return;
      }

      // Transform database profiles to User type - use local default instead of stock image
      const transformedUsers: User[] = (profiles || []).map(profile => ({
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
      }));

      setAllUsers(transformedUsers);
      
      // Load real messages from database (when messaging system is implemented)
      // For now, start with empty messages array - no more dummy data
      setAllMessages([]);
    } catch (error) {
      console.error('Error loading users and messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) {
      return allUsers;
    }

    const query = searchQuery.toLowerCase().trim();
    return allUsers.filter(user => {
      const nameMatch = user.name.toLowerCase().includes(query);
      const usernameMatch = user.username?.toLowerCase().includes(query);
      const usernameWithoutAt = query.startsWith('@') ? query.slice(1) : query;
      const usernameExactMatch = user.username?.toLowerCase().includes(usernameWithoutAt);
      
      return nameMatch || usernameMatch || usernameExactMatch;
    });
  }, [allUsers, searchQuery]);

  const getMessagesForUser = (userId: string): Message[] => {
    return allMessages.filter(msg => 
      msg.senderId === userId || msg.receiverId === userId
    );
  };

  const handleSendMessage = (content: string) => {
    if (!selectedUser) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: currentUserId,
      receiverId: selectedUser.id,
      content,
      timestamp: new Date().toISOString(),
      read: false
    };

    // Add to local state immediately for UI responsiveness
    setAllMessages(prev => [...prev, newMessage]);
    
    // TODO: Save to database when messaging system is implemented
    // await supabase.from('messages').insert(newMessage);
  };

  const handleSelectUser = (user: User & { isNearby: boolean }) => {
    setSelectedUser(user);
    if (onClearSelectedUser) {
      onClearSelectedUser();
    }
  };

  const handleBackToList = () => {
    setSelectedUser(undefined);
    if (onClearSelectedUser) {
      onClearSelectedUser();
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const selectedUserMessages = selectedUser ? getMessagesForUser(selectedUser.id) : [];

  if (isLoading) {
    return (
      <div className="h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-black flex">
      {/* Mobile: Show either chat list or chat window */}
      {isMobile ? (
        <>
          {!selectedUser ? (
            <div className="w-full flex flex-col">
              {/* Header with Search */}
              <div className="px-4 py-3 bg-black border-b border-gray-800 flex-shrink-0">
                <h2 className="text-xl font-bold text-white mb-3">Messages</h2>
                
                {/* Search Input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Search by name or @username"
                  />
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      <XMarkIcon className="h-5 w-5 text-gray-400 hover:text-white transition-colors" />
                    </button>
                  )}
                </div>
                
                {/* Search Results Count */}
                {searchQuery && (
                  <p className="text-sm text-gray-400 mt-2">
                    {filteredUsers.length === 0 
                      ? 'No users found' 
                      : `${filteredUsers.length} user${filteredUsers.length !== 1 ? 's' : ''} found`
                    }
                  </p>
                )}
              </div>
              
              {/* Chat List */}
              <div className="flex-1 overflow-hidden">
                <ChatList
                  users={filteredUsers}
                  messages={allMessages}
                  selectedUser={selectedUser}
                  onSelectUser={handleSelectUser}
                  searchQuery={searchQuery}
                />
              </div>
            </div>
          ) : (
            <div className="w-full">
              <ChatWindow
                user={selectedUser}
                messages={selectedUserMessages}
                onSendMessage={handleSendMessage}
                currentUserId={currentUserId}
                onBack={handleBackToList}
                onViewProfile={onViewProfile}
              />
            </div>
          )}
        </>
      ) : (
        /* Desktop: Show both panels */
        <>
          <div className="w-80 border-r border-gray-800 flex flex-col">
            {/* Header with Search */}
            <div className="px-4 py-3 bg-black border-b border-gray-800 flex-shrink-0">
              <h2 className="text-xl font-bold text-white mb-3">Messages</h2>
              
              {/* Search Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Search by name or @username"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-400 hover:text-white transition-colors" />
                  </button>
                )}
              </div>
              
              {/* Search Results Count */}
              {searchQuery && (
                <p className="text-sm text-gray-400 mt-2">
                  {filteredUsers.length === 0 
                    ? 'No users found' 
                    : `${filteredUsers.length} user${filteredUsers.length !== 1 ? 's' : ''} found`
                  }
                </p>
              )}
            </div>
            
            {/* Chat List */}
            <div className="flex-1 overflow-hidden">
              <ChatList
                users={filteredUsers}
                messages={allMessages}
                selectedUser={selectedUser}
                onSelectUser={handleSelectUser}
                searchQuery={searchQuery}
              />
            </div>
          </div>
          
          <div className="flex-1">
            {selectedUser ? (
              <ChatWindow
                user={selectedUser}
                messages={selectedUserMessages}
                onSendMessage={handleSendMessage}
                currentUserId={currentUserId}
                onBack={isMobile ? handleBackToList : undefined}
                onViewProfile={onViewProfile}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-gray-400">Select a conversation to start messaging</p>
                  {searchQuery && (
                    <p className="text-gray-500 text-sm mt-2">
                      Or search for someone to start a new conversation
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};