export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      community_comments: {
        Row: {
          author_id: string
          author_name: string
          body: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string
          author_name?: string
          body: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_id: string
          author_name: string
          body: string
          created_at: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          author_id?: string
          author_name?: string
          body: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          type?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          archived_at: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          privacy_accepted: boolean
          read_at: string | null
          status: string
          subject: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          privacy_accepted: boolean
          read_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          privacy_accepted?: boolean
          read_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      email_notification_log: {
        Row: {
          created_at: string
          id: string
          kind: string
          reason: string | null
          recipient: string | null
          related_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          reason?: string | null
          recipient?: string | null
          related_id?: string | null
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          reason?: string | null
          recipient?: string | null
          related_id?: string | null
          status?: string
        }
        Relationships: []
      }
      email_settings: {
        Row: {
          admin_inbox_url: string | null
          contact_notifications_enabled: boolean
          id: number
          newsletter_double_opt_in: boolean
          newsletter_notifications_enabled: boolean
          notification_recipient: string | null
          sender_domain: string | null
          sender_local_part: string
          sender_name: string
          updated_at: string
        }
        Insert: {
          admin_inbox_url?: string | null
          contact_notifications_enabled?: boolean
          id?: number
          newsletter_double_opt_in?: boolean
          newsletter_notifications_enabled?: boolean
          notification_recipient?: string | null
          sender_domain?: string | null
          sender_local_part?: string
          sender_name?: string
          updated_at?: string
        }
        Update: {
          admin_inbox_url?: string | null
          contact_notifications_enabled?: boolean
          id?: number
          newsletter_double_opt_in?: boolean
          newsletter_notifications_enabled?: boolean
          notification_recipient?: string | null
          sender_domain?: string | null
          sender_local_part?: string
          sender_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          confirm_token: string | null
          confirmed_at: string | null
          consent_given_at: string
          consent_text: string
          consent_version: string
          created_at: string
          email: string
          id: string
          ip_hash: string | null
          opt_in_method: string
          source: string
          status: string
          subscribe_count: number
          unsubscribe_token: string
          unsubscribed_at: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          confirm_token?: string | null
          confirmed_at?: string | null
          consent_given_at?: string
          consent_text: string
          consent_version: string
          created_at?: string
          email: string
          id?: string
          ip_hash?: string | null
          opt_in_method?: string
          source?: string
          status?: string
          subscribe_count?: number
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          confirm_token?: string | null
          confirmed_at?: string | null
          consent_given_at?: string
          consent_text?: string
          consent_version?: string
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string | null
          opt_in_method?: string
          source?: string
          status?: string
          subscribe_count?: number
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      community_post_visible: { Args: { _post: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
    },
  },
} as const
