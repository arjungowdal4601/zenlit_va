// This file should be generated by running:
// supabase gen types typescript --local > src/types/supabase.ts
// or
// npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/supabase.ts

// Placeholder types until you regenerate the actual Supabase types
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string | null;
          username: string | null;
          email: string | null;
          bio: string | null;
          profile_photo_url: string | null;
          cover_photo_url: string | null;
          date_of_birth: string | null;
          gender: string | null;
          location: string | null;
          latitude: number | null;
          longitude: number | null;
          hide_from_radar: boolean | null;
          instagram_url: string | null;
          linked_in_url: string | null;
          twitter_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name?: string | null;
          username?: string | null;
          email?: string | null;
          bio?: string | null;
          profile_photo_url?: string | null;
          cover_photo_url?: string | null;
          date_of_birth?: string | null;
          gender?: string | null;
          location?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          hide_from_radar?: boolean | null;
          instagram_url?: string | null;
          linked_in_url?: string | null;
          twitter_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          username?: string | null;
          email?: string | null;
          bio?: string | null;
          profile_photo_url?: string | null;
          cover_photo_url?: string | null;
          date_of_birth?: string | null;
          gender?: string | null;
          location?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          hide_from_radar?: boolean | null;
          instagram_url?: string | null;
          linked_in_url?: string | null;
          twitter_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          participant_1_id: string;
          participant_2_id: string;
          created_at: string;
          updated_at: string;
          last_message_at: string;
        };
        Insert: {
          id?: string;
          participant_1_id: string;
          participant_2_id: string;
          created_at?: string;
          updated_at?: string;
          last_message_at?: string;
        };
        Update: {
          id?: string;
          participant_1_id?: string;
          participant_2_id?: string;
          created_at?: string;
          updated_at?: string;
          last_message_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          created_at: string;
          read: boolean;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          created_at?: string;
          read?: boolean;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          content?: string;
          created_at?: string;
          read?: boolean;
        };
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          caption: string;
          media_url: string;
          media_type: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          caption: string;
          media_url: string;
          media_type?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          caption?: string;
          media_url?: string;
          media_type?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_or_create_conversation: {
        Args: {
          user1_id: string;
          user2_id: string;
        };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
};