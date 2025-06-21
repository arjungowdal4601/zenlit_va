import { format } from 'date-fns';
import { type MessageWithSender } from '../../lib/messaging';

interface MessageBubbleProps {
  message: MessageWithSender;
  isCurrentUser: boolean;
  isOptimistic?: boolean;
}

export const MessageBubble = ({ message, isCurrentUser, isOptimistic = false }: MessageBubbleProps) => {
  return (
    <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div 
        className={`max-w-[80%] px-4 py-3 rounded-2xl ${
          isCurrentUser 
            ? `bg-blue-600 text-white rounded-br-md ${isOptimistic ? 'opacity-70' : ''}` 
            : 'bg-gray-800 text-white rounded-bl-md'
        }`}
      >
        <p className="text-sm leading-relaxed">{message.content}</p>
        <div className="flex items-center justify-between mt-1">
          <p className={`text-xs ${
            isCurrentUser ? 'text-blue-100' : 'text-gray-400'
          }`}>
            {format(new Date(message.timestamp), 'HH:mm')}
          </p>
          {isOptimistic && (
            <div className="ml-2">
              <div className="w-3 h-3 border border-blue-200 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};