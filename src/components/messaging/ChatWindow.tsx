import { useState, useEffect, useRef } from 'react';
import { Message, User } from '../../types';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';

interface ChatWindowProps {
  user: User & { isNearby?: boolean };
  messages: Message[];
  onSendMessage: (content: string) => void;
  currentUserId: string;
  onBack?: () => void;
  onViewProfile?: (user: User) => void;
}

export const ChatWindow = ({
  user,
  messages,
  onSendMessage,
  currentUserId,
  onBack,
  onViewProfile
}: ChatWindowProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isNearby = user.isNearby !== false;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleProfileClick = () => {
    if (onViewProfile && isNearby) {
      onViewProfile(user);
    }
  };

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
            onClick={isNearby ? handleProfileClick : undefined}
            disabled={!isNearby}
            className={`flex items-center flex-1 rounded-lg p-2 -m-2 ${
              isNearby ? 'hover:bg-gray-800/50 transition-colors active:scale-95' : ''
            }`}
          >
            <img
              src={isNearby ? user.dpUrl : '/images/default-avatar.png'}
              alt={isNearby ? user.name : 'Anonymous'}
              className={`w-9 h-9 rounded-full object-cover mr-3 ${
                isNearby ? 'ring-2 ring-blue-500' : 'bg-gray-700'
              }`}
            />
            <div className="text-left">
              <h3 className="font-semibold text-white">{isNearby ? user.name : 'Anonymous'}</h3>
              {isNearby && (
                <p className="text-xs text-gray-400">Active now</p>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <img
                src={isNearby ? user.dpUrl : '/images/default-avatar.png'}
                alt={isNearby ? user.name : 'Anonymous'}
                className="w-16 h-16 rounded-full mx-auto mb-4"
              />
              <p className="text-gray-400">Start a conversation with {isNearby ? user.name : 'Anonymous'}</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isCurrentUser={message.senderId === currentUserId}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <div className="border-t border-gray-800 p-4">
        <MessageInput onSendMessage={onSendMessage} />
      </div>
    </div>
  );
};