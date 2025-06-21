import { useState, useEffect, useRef } from 'react';
import { User } from '../../types';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { type Conversation, type MessageWithSender } from '../../lib/messaging';

interface ChatWindowProps {
  conversation: Conversation;
  messages: MessageWithSender[];
  onSendMessage: (content: string) => void;
  currentUserId: string;
  onBack?: () => void;
  onViewProfile?: (user: User) => void;
  isLoading?: boolean;
}

export const ChatWindow = ({
  conversation,
  messages,
  onSendMessage,
  currentUserId,
  onBack,
  onViewProfile,
  isLoading = false
}: ChatWindowProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<MessageWithSender[]>([]);
  const otherParticipant = conversation.other_participant;

  // Combine real messages with optimistic messages, removing duplicates
  const allMessages = [...messages, ...optimisticMessages].filter((message, index, arr) => {
    // Remove optimistic messages that have been confirmed by real messages
    if (message.id.startsWith('optimistic-')) {
      return !messages.some(realMsg => 
        realMsg.content === message.content && 
        realMsg.senderId === message.senderId &&
        Math.abs(new Date(realMsg.timestamp).getTime() - new Date(message.timestamp).getTime()) < 10000
      );
    }
    return true;
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [allMessages]);

  // Clear confirmed optimistic messages when real messages update
  useEffect(() => {
    if (messages.length > 0) {
      setOptimisticMessages(prev => 
        prev.filter(optimistic => 
          !messages.some(real => 
            real.content === optimistic.content && 
            real.senderId === optimistic.senderId &&
            Math.abs(new Date(real.timestamp).getTime() - new Date(optimistic.timestamp).getTime()) < 10000
          )
        )
      );
    }
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    console.log('🔍 [ChatWindow] Sending message with optimistic rendering');
    
    // Create optimistic message for immediate UI feedback
    const optimisticMessage: MessageWithSender = {
      id: `optimistic-${Date.now()}-${Math.random()}`,
      senderId: currentUserId,
      receiverId: otherParticipant?.id || '',
      content,
      timestamp: new Date().toISOString(),
      read: false,
      sender: {
        id: currentUserId,
        name: 'You',
        profile_photo_url: undefined
      }
    };

    // Add optimistic message to UI immediately
    setOptimisticMessages(prev => [...prev, optimisticMessage]);
    
    // Send the actual message
    onSendMessage(content);

    // Remove optimistic message after 15 seconds if not confirmed
    setTimeout(() => {
      setOptimisticMessages(prev => 
        prev.filter(msg => msg.id !== optimisticMessage.id)
      );
    }, 15000);
  };

  const handleProfileClick = () => {
    if (onViewProfile && otherParticipant) {
      const user: User = {
        id: otherParticipant.id,
        name: otherParticipant.name,
        username: otherParticipant.username,
        dpUrl: otherParticipant.profile_photo_url || '/images/default-avatar.png',
        bio: '', // We don't have bio in conversation data
        gender: 'male', // Default value
        age: 25, // Default value
        distance: 0,
        links: {
          Twitter: '#',
          Instagram: '#',
          LinkedIn: '#'
        }
      };
      onViewProfile(user);
    }
  };

  if (!otherParticipant) {
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <p className="text-gray-400">Unable to load conversation</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Pinned Chat Header with Back Button */}
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center px-4 py-3">
          {onBack && (
            <button
              onClick={onBack}
              className="mr-3 p-2 rounded-full hover:bg-gray-800 active:scale-95 transition-all"
            >
              <ChevronLeftIcon className="w-5 h-5 text-white" />
            </button>
          )}
          
          {/* Clickable profile area */}
          <button
            onClick={handleProfileClick}
            className="flex items-center flex-1 rounded-lg p-2 -m-2 hover:bg-gray-800/50 transition-colors active:scale-95"
          >
            <img
              src={otherParticipant.profile_photo_url || '/images/default-avatar.png'}
              alt={otherParticipant.name}
              className="w-9 h-9 rounded-full object-cover mr-3 ring-2 ring-blue-500"
            />
            <div className="text-left">
              <h3 className="font-semibold text-white">{otherParticipant.name}</h3>
              {otherParticipant.username && (
                <p className="text-xs text-gray-400">@{otherParticipant.username}</p>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-gray-400 text-sm">Loading messages...</p>
            </div>
          </div>
        ) : allMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <img
                src={otherParticipant.profile_photo_url || '/images/default-avatar.png'}
                alt={otherParticipant.name}
                className="w-16 h-16 rounded-full mx-auto mb-4"
              />
              <p className="text-gray-400">Start a conversation with {otherParticipant.name}</p>
            </div>
          </div>
        ) : (
          <>
            {allMessages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isCurrentUser={message.senderId === currentUserId}
                isOptimistic={message.id.startsWith('optimistic-')}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <div className="border-t border-gray-800 p-4">
        <MessageInput onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
};