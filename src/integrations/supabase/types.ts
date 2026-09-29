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
          sector: string
          status: string
          updated_at: string
          visibility: string
        }
        Insert: {
          author_id?: string
          author_name?: string
          body: string
          created_at?: string
          id?: string
          sector?: string
          status?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_id?: string
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          sector?: string
          status?: string
          updated_at?: string
          visibility?: string
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
      community_reports: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reason: string
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reason: string
          reporter_id?: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reason?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reports_post_id_fkey"
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
      library_categories: {
        Row: {
          created_at: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      library_item_content: {
        Row: {
          body: string
          external_url: string | null
          file_name: string | null
          file_path: string | null
          item_id: string
          updated_at: string
        }
        Insert: {
          body?: string
          external_url?: string | null
          file_name?: string | null
          file_path?: string | null
          item_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          external_url?: string | null
          file_name?: string | null
          file_path?: string | null
          item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_item_content_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "library_items"
            referencedColumns: ["id"]
          },
        ]
      }
      library_items: {
        Row: {
          access: string
          author_name: string
          category: string
          cover_url: string | null
          created_at: string
          created_by: string | null
          currency: string
          delivery_method: string
          id: string
          kind: string
          payment_product_id: string | null
          price_amount: number | null
          published_at: string | null
          purchasable: boolean
          slug: string
          status: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          access?: string
          author_name?: string
          category: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          delivery_method?: string
          id?: string
          kind?: string
          payment_product_id?: string | null
          price_amount?: number | null
          published_at?: string | null
          purchasable?: boolean
          slug: string
          status?: string
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          access?: string
          author_name?: string
          category?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          delivery_method?: string
          id?: string
          kind?: string
          payment_product_id?: string | null
          price_amount?: number | null
          published_at?: string | null
          purchasable?: boolean
          slug?: string
          status?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_items_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "library_categories"
            referencedColumns: ["slug"]
          },
        ]
      }
      library_order_events: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          order_id: string
          type: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          order_id: string
          type: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          order_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "library_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      library_orders: {
        Row: {
          access_expires_at: string | null
          access_token: string
          amount: number
          buyer_email: string
          buyer_name: string | null
          buyer_phone: string | null
          cancelled_at: string | null
          checkout_session_id: string | null
          consent_text: string | null
          created_at: string
          currency: string
          delivered_at: string | null
          delivered_marked_by: string | null
          delivery_error: string | null
          delivery_status: string
          environment: string
          failed_at: string | null
          id: string
          item_id: string
          order_number: string
          paid_at: string | null
          paid_marked_by: string | null
          payment_method: string
          provider: string | null
          provider_ref: string | null
          refunded_at: string | null
          status: string
          status_changed_at: string | null
          status_changed_by: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_expires_at?: string | null
          access_token?: string
          amount: number
          buyer_email: string
          buyer_name?: string | null
          buyer_phone?: string | null
          cancelled_at?: string | null
          checkout_session_id?: string | null
          consent_text?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          delivered_marked_by?: string | null
          delivery_error?: string | null
          delivery_status?: string
          environment?: string
          failed_at?: string | null
          id?: string
          item_id: string
          order_number?: string
          paid_at?: string | null
          paid_marked_by?: string | null
          payment_method?: string
          provider?: string | null
          provider_ref?: string | null
          refunded_at?: string | null
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_expires_at?: string | null
          access_token?: string
          amount?: number
          buyer_email?: string
          buyer_name?: string | null
          buyer_phone?: string | null
          cancelled_at?: string | null
          checkout_session_id?: string | null
          consent_text?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          delivered_marked_by?: string | null
          delivery_error?: string | null
          delivery_status?: string
          environment?: string
          failed_at?: string | null
          id?: string
          item_id?: string
          order_number?: string
          paid_at?: string | null
          paid_marked_by?: string | null
          payment_method?: string
          provider?: string | null
          provider_ref?: string | null
          refunded_at?: string | null
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_orders_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "library_items"
            referencedColumns: ["id"]
          },
        ]
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
      payment_webhook_events: {
        Row: {
          environment: string
          event_id: string
          received_at: string
          type: string
        }
        Insert: {
          environment: string
          event_id: string
          received_at?: string
          type: string
        }
        Update: {
          environment?: string
          event_id?: string
          received_at?: string
          type?: string
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
      community_feed: {
        Args: {
          _limit: number
          _offset: number
          _only_mine: boolean
          _sort: string
        }
        Returns: {
          author_id: string
          author_name: string
          body: string
          comments: number
          created_at: string
          id: string
          reacted: boolean
          reactions: number
          sector: string
          status: string
          updated_at: string
          visibility: string
        }[]
      }
      community_feed_filtered: {
        Args: {
          _author: string
          _limit: number
          _offset: number
          _only_mine: boolean
          _sector: string
          _sort: string
        }
        Returns: {
          author_id: string
          author_name: string
          body: string
          comments: number
          created_at: string
          id: string
          reacted: boolean
          reactions: number
          sector: string
          status: string
          updated_at: string
          visibility: string
        }[]
      }
      community_post_stats: {
        Args: { _post: string }
        Returns: {
          comments: number
          reactions: number
        }[]
      }
      community_post_visible: { Args: { _post: string }; Returns: boolean }
      community_search: {
        Args: { _q: string }
        Returns: {
          id: string
          kind: string
          label: string
          sector: string
          snippet: string
        }[]
      }
      community_sector_counts: {
        Args: never
        Returns: {
          posts: number
          sector: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      library_can_read: { Args: { _item: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "premium"
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
      app_role: ["admin", "premium"],
    },
  },
} as const
