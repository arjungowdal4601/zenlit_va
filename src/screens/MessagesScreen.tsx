import { useState, useEffect, useMemo, useRef } from 'react';
import { ChatList } from '../components/messaging/ChatList';
import { ChatWindow } from '../components/messaging/ChatWindow';
import { User, Message } from '../types';
import { supabase } from '../lib/supabase';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { 
  getUserConversations, 
  getOrCreateConversation, 
  getConversationMessages, 
  sendMessage, 
  subscribeToMessages, 
  subscribeToConversations,
  type Conversation,
  type MessageWithSender
} from '../lib/messaging';

interface Props {
  selectedUser?: (User & { isNearby?: boolean }) | null;
  onClearSelectedUser?: () => void;
  onViewProfile?: (user: User) => void;
  onHideBottomNav?: (hide: boolean) => void;
}

export const MessagesScreen: React.FC<Props> = ({ 
  selectedUser: initialSelectedUser, 
  onClearSelectedUser,
  onViewProfile,
  onHideBottomNav
}) => {
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMobile] = useState(window.innerWidth < 768);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Use refs to store subscription instances
  const conversationSubscriptionRef = useRef<any>(null);
  const messageSubscriptionRef = useRef<any>(null);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (initialSelectedUser && currentUserId) {
      handleSelectUserForChat(initialSelectedUser);
    }
  }, [initialSelectedUser, currentUserId]);

  // Handle bottom nav visibility
  useEffect(() => {
    if (onHideBottomNav) {
      onHideBottomNav(!!selectedConversation);
    }
  }, [selectedConversation, onHideBottomNav]);

  // Separate useEffect for conversation subscriptions
  useEffect(() => {
    if (!currentUserId) return;

    const setupConversationSubscription = async () => {
      try {
        await loadConversations(currentUserId);
        
        // Clean up any existing subscription
        if (conversationSubscriptionRef.current) {
          conversationSubscriptionRef.current.unsubscribe();
        }
        
        // Subscribe to conversation updates
        conversationSubscriptionRef.current = subscribeToConversations(
          currentUserId,
          (updatedConversation) => {
            setConversations(prev => {
              const index = prev.findIndex(c => c.id === updatedConversation.id);
              if (index >= 0) {
                const updated = [...prev];
                updated[index] = updatedConversation;
                return updated.sort((a, b) => 
                  new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
                );
              } else {
                return [updatedConversation, ...prev];
              }
            });
          },
          (error) => {
            console.error('Conversation subscription error:', error);
          }
        );
      } catch (error) {
        console.error('Error setting up conversation subscription:', error);
      }
    };

    setupConversationSubscription();

    // Cleanup function
    return () => {
      if (conversationSubscriptionRef.current) {
        conversationSubscriptionRef.current.unsubscribe();
        conversationSubscriptionRef.current = null;
      }
    };
  }, [currentUserId]);

  // Separate useEffect for message subscriptions
  useEffect(() => {
    if (!selectedConversation) {
      // Clean up message subscription when no conversation is selected
      if (messageSubscriptionRef.current) {
        messageSubscriptionRef.current.unsubscribe();
        messageSubscriptionRef.current = null;
      }
      setMessages([]);
      return;
    }

    const setupMessageSubscription = async () => {
      setIsLoadingMessages(true);
      
      try {
        // Clean up any existing message subscription
        if (messageSubscriptionRef.current) {
          messageSubscriptionRef.current.unsubscribe();
        }

        const result = await getConversationMessages(selectedConversation.id);
        
        if (result.success && result.messages) {
          setMessages(result.messages);
          
          // Subscribe to new messages
          messageSubscriptionRef.current = subscribeToMessages(
            selectedConversation.id,
            (newMessage) => {
              setMessages(prev => [...prev, newMessage]);
            },
            (error) => {
              console.error('Messages subscription error:', error);
            }
          );
        } else {
          console.error('Failed to load messages:', result.error);
        }
      } catch (error) {
        console.error('Error setting up message subscription:', error);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    setupMessageSubscription();

    // Cleanup function
    return () => {
      if (messageSubscriptionRef.current) {
        messageSubscriptionRef.current.unsubscribe();
        messageSubscriptionRef.current = null;
      }
    };
  }, [selectedConversation]);

  const loadCurrentUser = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) return;

      setCurrentUserId(currentUser.id);
    } catch (error) {
      console.error('Error loading current user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversations = async (userId: string) => {
    try {
      const result = await getUserConversations(userId);
      
      if (result.success && result.conversations) {
        setConversations(result.conversations);
      } else {
        console.error('Failed to load conversations:', result.error);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const handleSelectUserForChat = async (user: User & { isNearby?: boolean }) => {
    if (!currentUserId) return;

    try {
      // Get or create conversation
      const result = await getOrCreateConversation(currentUserId, user.id);
      
      if (result.success && result.conversation) {
        setSelectedConversation(result.conversation);
      } else {
        console.error('Failed to create conversation:', result.error);
      }
    } catch (error) {
      console.error('Error selecting user for chat:', error);
    }
  };

  const handleSelectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedConversation || !currentUserId) return;

    try {
      const result = await sendMessage(selectedConversation.id, currentUserId, content);
      
      if (result.success && result.message) {
        // Message will be added via subscription
        console.log('Message sent successfully');
      } else {
        console.error('Failed to send message:', result.error);
        alert('Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
    if (onClearSelectedUser) {
      onClearSelectedUser();
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  // Filter conversations based on search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) {
      return conversations;
    }

    const query = searchQuery.toLowerCase().trim();
    return conversations.filter(conversation => {
      const otherParticipant = conversation.other_participant;
      if (!otherParticipant) return false;
      
      const nameMatch = otherParticipant.name.toLowerCase().includes(query);
      const usernameMatch = otherParticipant.username?.toLowerCase().includes(query);
      const usernameWithoutAt = query.startsWith('@') ? query.slice(1) : query;
      const usernameExactMatch = otherParticipant.username?.toLowerCase().includes(usernameWithoutAt);
      
      return nameMatch || usernameMatch || usernameExactMatch;
    });
  }, [conversations, searchQuery]);

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
          {!selectedConversation ? (
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
                    placeholder="Search conversations..."
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
                    {filteredConversations.length === 0 
                      ? 'No conversations found' 
                      : `${filteredConversations.length} conversation${filteredConversations.length !== 1 ? 's' : ''} found`
                    }
                  </p>
                )}
              </div>
              
              {/* Conversations List */}
              <div className="flex-1 overflow-hidden">
                <ChatList
                  conversations={filteredConversations}
                  selectedConversation={selectedConversation}
                  onSelectConversation={handleSelectConversation}
                  searchQuery={searchQuery}
                />
              </div>
            </div>
          ) : (
            <div className="w-full">
              <ChatWindow
                conversation={selectedConversation}
                messages={messages}
                onSendMessage={handleSendMessage}
                currentUserId={currentUserId}
                onBack={handleBackToList}
                onViewProfile={onViewProfile}
                isLoading={isLoadingMessages}
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
                  placeholder="Search conversations..."
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
                  {filteredConversations.length === 0 
                    ? 'No conversations found' 
                    : `${filteredConversations.length} conversation${filteredConversations.length !== 1 ? 's' : ''} found`
                  }
                </p>
              )}
            </div>
            
            {/* Conversations List */}
            <div className="flex-1 overflow-hidden">
              <ChatList
                conversations={filteredConversations}
                selectedConversation={selectedConversation}
                onSelectConversation={handleSelectConversation}
                searchQuery={searchQuery}
              />
            </div>
          </div>
          
          <div className="flex-1">
            {selectedConversation ? (
              <ChatWindow
                conversation={selectedConversation}
                messages={messages}
                onSendMessage={handleSendMessage}
                currentUserId={currentUserId}
                onBack={isMobile ? handleBackToList : undefined}
                onViewProfile={onViewProfile}
                isLoading={isLoadingMessages}
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