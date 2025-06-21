import { format } from 'date-fns';
import { type Conversation } from '../../lib/messaging';

interface ChatListProps {
  conversations: Conversation[];
  selectedConversation?: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
  searchQuery?: string;
}

export const ChatList = ({
  conversations,
  selectedConversation,
  onSelectConversation,
  searchQuery = ''
}: ChatListProps) => {
  // Show empty state when searching but no results
  if (searchQuery && conversations.length === 0) {
    return (
      <div className="flex flex-col h-full bg-black">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-gray-400 mb-2">No conversations found</p>
            <p className="text-gray-500 text-sm">
              Try searching by name or username
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show empty state when no conversations exist
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col h-full bg-black">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-gray-400 mb-2">No conversations yet</p>
            <p className="text-gray-500 text-sm">
              Start a conversation by messaging someone from the radar
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conversation) => {
          const otherParticipant = conversation.other_participant;
          const latestMessage = conversation.latest_message;

          if (!otherParticipant) return null;

          return (
            <button
              key={conversation.id}
              onClick={() => onSelectConversation(conversation)}
              className={`flex items-center px-4 py-3 w-full text-left transition-colors ${
                selectedConversation?.id === conversation.id 
                  ? 'bg-gray-800' 
                  : 'hover:bg-gray-900'
              }`}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="relative flex-shrink-0">
                  <img 
                    src={otherParticipant.profile_photo_url || '/images/default-avatar.png'} 
                    alt={otherParticipant.name} 
                    className="w-11 h-11 rounded-full object-cover ring-2 ring-blue-500"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex flex-col min-w-0">
                      <h3 className="font-semibold text-white truncate">{otherParticipant.name}</h3>
                      {otherParticipant.username && (
                        <p className="text-xs text-gray-500">@{otherParticipant.username}</p>
                      )}
                    </div>
                    {latestMessage && (
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {format(new Date(latestMessage.created_at), 'HH:mm')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    {latestMessage ? (
                      <p className="text-sm text-gray-400 truncate pr-2">
                        {latestMessage.content.length > 35 
                          ? `${latestMessage.content.substring(0, 35)}...` 
                          : latestMessage.content}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 italic">Start a conversation</p>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};