import { format } from 'date-fns';
import { type MessageWithSender } from '../../lib/messaging';

interface MessageBubbleProps {
  message: MessageWithSender;
  isCurrentUser: boolean;
}

export const MessageBubble = ({ message, isCurrentUser }: MessageBubbleProps) => {
  return (
    <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div 
        className={`max-w-[80%] px-4 py-3 rounded-2xl ${
          isCurrentUser 
            ? 'bg-blue-600 text-white rounded-br-md' 
            : 'bg-gray-800 text-white rounded-bl-md'
        }`}
      >
        <p className="text-sm leading-relaxed">{message.content}</p>
        <p className={`text-xs mt-1 ${
          isCurrentUser ? 'text-blue-100' : 'text-gray-400'
        }`}>
          {format(new Date(message.timestamp), 'HH:mm')}
        </p>
      </div>
    </div>
  );
};