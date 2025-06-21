import { supabase } from './supabase';
import { Message } from '../types';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';

export interface Conversation {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  other_participant?: {
    id: string;
    name: string;
    username?: string;
    profile_photo_url?: string;
  };
  latest_message?: {
    content: string;
    created_at: string;
    sender_id: string;
  };
}

export interface MessageWithSender extends Message {
  sender?: {
    id: string;
    name: string;
    profile_photo_url?: string;
  };
}

// Get or create a conversation between two users
export const getOrCreateConversation = async (
  currentUserId: string,
  otherUserId: string
): Promise<{
  success: boolean;
  conversation?: Conversation;
  error?: string;
}> => {
  try {
    console.log('🔍 [getOrCreateConversation] Getting or creating conversation between:', currentUserId, 'and', otherUserId);

    if (!currentUserId || !otherUserId) {
      return {
        success: false,
        error: 'Invalid user IDs provided'
      };
    }

    // Call the database function to get or create conversation
    const { data, error } = await supabase.rpc('get_or_create_conversation', {
      user1_id: currentUserId,
      user2_id: otherUserId
    });

    console.log('🔍 [getOrCreateConversation] RPC result:', { data, error });

    if (error) {
      console.error('🔍 [getOrCreateConversation] Error getting/creating conversation:', error);
      return {
        success: false,
        error: error.message || 'Failed to create conversation'
      };
    }

    // Get the full conversation details
    const { data: conversation, error: fetchError } = await supabase
      .from('conversations')
      .select(`
        *,
        participant_1:participant_1_id(id, name, username, profile_photo_url),
        participant_2:participant_2_id(id, name, username, profile_photo_url)
      `)
      .eq('id', data)
      .single();

    console.log('🔍 [getOrCreateConversation] Conversation fetch result:', { conversation, fetchError });

    if (fetchError) {
      console.error('🔍 [getOrCreateConversation] Error fetching conversation details:', fetchError);
      return {
        success: false,
        error: fetchError.message || 'Failed to fetch conversation details'
      };
    }

    // Determine the other participant
    const otherParticipant = conversation.participant_1_id === currentUserId 
      ? conversation.participant_2 
      : conversation.participant_1;

    const formattedConversation: Conversation = {
      id: conversation.id,
      participant_1_id: conversation.participant_1_id,
      participant_2_id: conversation.participant_2_id,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at,
      last_message_at: conversation.last_message_at,
      other_participant: otherParticipant
    };

    console.log('🔍 [getOrCreateConversation] Success:', formattedConversation);

    return {
      success: true,
      conversation: formattedConversation
    };

  } catch (error) {
    console.error('🔍 [getOrCreateConversation] Error in getOrCreateConversation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create conversation'
    };
  }
};

// Get all conversations for a user
export const getUserConversations = async (
  userId: string
): Promise<{
  success: boolean;
  conversations?: Conversation[];
  error?: string;
}> => {
  try {
    console.log('🔍 [getUserConversations] Getting conversations for user:', userId);

    if (!userId) {
      return {
        success: false,
        error: 'User ID is required'
      };
    }

    // First, get conversations with participant info
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        *,
        participant_1:participant_1_id(id, name, username, profile_photo_url),
        participant_2:participant_2_id(id, name, username, profile_photo_url)
      `)
      .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
      .order('last_message_at', { ascending: false });

    console.log('🔍 [getUserConversations] Raw query result:', { conversations, error });

    if (error) {
      console.error('🔍 [getUserConversations] Error fetching conversations:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch conversations'
      };
    }

    // For each conversation, get the latest message separately
    const formattedConversations: Conversation[] = [];
    
    for (const conv of conversations || []) {
      const otherParticipant = conv.participant_1_id === userId 
        ? conv.participant_2 
        : conv.participant_1;

      // Get the latest message for this conversation
      const { data: latestMessages, error: messageError } = await supabase
        .from('messages')
        .select('content, created_at, sender_id')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (messageError) {
        console.error('🔍 [getUserConversations] Error fetching latest message for conversation:', conv.id, messageError);
      }

      const latestMessage = latestMessages && latestMessages.length > 0 
        ? latestMessages[0] 
        : undefined;

      formattedConversations.push({
        id: conv.id,
        participant_1_id: conv.participant_1_id,
        participant_2_id: conv.participant_2_id,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        last_message_at: conv.last_message_at,
        other_participant: otherParticipant,
        latest_message: latestMessage
      });
    }

    console.log('🔍 [getUserConversations] Formatted conversations:', formattedConversations);

    return {
      success: true,
      conversations: formattedConversations
    };

  } catch (error) {
    console.error('🔍 [getUserConversations] Error in getUserConversations:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch conversations'
    };
  }
};

// Get messages for a conversation
export const getConversationMessages = async (
  conversationId: string,
  limit: number = 50
): Promise<{
  success: boolean;
  messages?: MessageWithSender[];
  error?: string;
}> => {
  try {
    console.log('🔍 [getConversationMessages] Getting messages for conversation:', conversationId);

    if (!conversationId) {
      return {
        success: false,
        error: 'Conversation ID is required'
      };
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:sender_id(id, name, profile_photo_url)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    console.log('🔍 [getConversationMessages] Messages query result:', { messages, error });

    if (error) {
      console.error('🔍 [getConversationMessages] Error fetching messages:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch messages'
      };
    }

    // Transform to MessageWithSender format
    const formattedMessages: MessageWithSender[] = (messages || []).map(msg => ({
      id: msg.id,
      senderId: msg.sender_id,
      receiverId: '', // Will be determined from conversation participants
      content: msg.content,
      timestamp: msg.created_at,
      read: msg.read,
      sender: msg.sender
    }));

    console.log('🔍 [getConversationMessages] Formatted messages:', formattedMessages);

    return {
      success: true,
      messages: formattedMessages
    };

  } catch (error) {
    console.error('🔍 [getConversationMessages] Error in getConversationMessages:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch messages'
    };
  }
};

// Send a message
export const sendMessage = async (
  conversationId: string,
  senderId: string,
  content: string
): Promise<{
  success: boolean;
  message?: MessageWithSender;
  error?: string;
}> => {
  try {
    console.log('🔍 [sendMessage] Sending message to conversation:', conversationId);

    if (!conversationId || !senderId || !content.trim()) {
      return {
        success: false,
        error: 'Missing required parameters'
      };
    }

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: content.trim()
      })
      .select(`
        *,
        sender:sender_id(id, name, profile_photo_url)
      `)
      .single();

    console.log('🔍 [sendMessage] Message insert result:', { message, error });

    if (error) {
      console.error('🔍 [sendMessage] Error sending message:', error);
      return {
        success: false,
        error: error.message || 'Failed to send message'
      };
    }

    // Transform to MessageWithSender format
    const formattedMessage: MessageWithSender = {
      id: message.id,
      senderId: message.sender_id,
      receiverId: '', // Will be determined from conversation participants
      content: message.content,
      timestamp: message.created_at,
      read: message.read,
      sender: message.sender
    };

    return {
      success: true,
      message: formattedMessage
    };

  } catch (error) {
    console.error('🔍 [sendMessage] Error in sendMessage:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message'
    };
  }
};

// Mark messages as read
export const markMessagesAsRead = async (
  conversationId: string,
  userId: string
): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    console.log('🔍 [markMessagesAsRead] Marking messages as read for conversation:', conversationId);

    const { error } = await supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .eq('read', false);

    if (error) {
      console.error('🔍 [markMessagesAsRead] Error marking messages as read:', error);
      return {
        success: false,
        error: error.message || 'Failed to mark messages as read'
      };
    }

    return { success: true };

  } catch (error) {
    console.error('🔍 [markMessagesAsRead] Error in markMessagesAsRead:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark messages as read'
    };
  }
};

// Subscribe to new messages in a conversation
export const subscribeToMessages = (
  conversationId: string,
  onNewMessage: (message: MessageWithSender) => void,
  onError: (error: string) => void
) => {
  console.log('🔍 [subscribeToMessages] Subscribing to messages for conversation:', conversationId);

  const subscription = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      async (payload) => {
        console.log('🔍 [subscribeToMessages] New message received:', payload);

        // Fetch the complete message with sender info
        const { data: message, error } = await supabase
          .from('messages')
          .select(`
            *,
            sender:sender_id(id, name, profile_photo_url)
          `)
          .eq('id', payload.new.id)
          .single();

        if (error) {
          console.error('🔍 [subscribeToMessages] Error fetching new message details:', error);
          onError('Failed to fetch new message details');
          return;
        }

        const formattedMessage: MessageWithSender = {
          id: message.id,
          senderId: message.sender_id,
          receiverId: '',
          content: message.content,
          timestamp: message.created_at,
          read: message.read,
          sender: message.sender
        };

        onNewMessage(formattedMessage);
      }
    )
    .subscribe((status) => {
      console.log('🔍 [subscribeToMessages] Message subscription status:', status);
      if (status === REALTIME_SUBSCRIBE_STATES.CLOSED) {
        onError('Message subscription was closed');
      }
    });

  return subscription;
};

// Subscribe to conversation updates
export const subscribeToConversations = (
  userId: string,
  onConversationUpdate: (conversation: Conversation) => void,
  onError: (error: string) => void
) => {
  console.log('🔍 [subscribeToConversations] Subscribing to conversation updates for user:', userId);

  const subscription = supabase
    .channel(`conversations:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `or(participant_1_id.eq.${userId},participant_2_id.eq.${userId})`
      },
      async (payload) => {
        console.log('🔍 [subscribeToConversations] Conversation update received:', payload);

        // Fetch the complete conversation with participant info
        const { data: conversation, error } = await supabase
          .from('conversations')
          .select(`
            *,
            participant_1:participant_1_id(id, name, username, profile_photo_url),
            participant_2:participant_2_id(id, name, username, profile_photo_url)
          `)
          .eq('id', payload.new.id)
          .single();

        if (error) {
          console.error('🔍 [subscribeToConversations] Error fetching conversation details:', error);
          onError('Failed to fetch conversation details');
          return;
        }

        const otherParticipant = conversation.participant_1_id === userId 
          ? conversation.participant_2 
          : conversation.participant_1;

        const formattedConversation: Conversation = {
          id: conversation.id,
          participant_1_id: conversation.participant_1_id,
          participant_2_id: conversation.participant_2_id,
          created_at: conversation.created_at,
          updated_at: conversation.updated_at,
          last_message_at: conversation.last_message_at,
          other_participant: otherParticipant
        };

        onConversationUpdate(formattedConversation);
      }
    )
    .subscribe((status) => {
      console.log('🔍 [subscribeToConversations] Conversation subscription status:', status);
      if (status === REALTIME_SUBSCRIBE_STATES.CLOSED) {
        onError('Conversation subscription was closed');
      }
    });

  return subscription;
};