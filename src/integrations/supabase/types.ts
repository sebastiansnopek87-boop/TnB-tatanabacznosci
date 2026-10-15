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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_events: {
        Row: {
          actor: string | null
          created_at: string
          detail: string | null
          id: string
          object_id: string | null
          object_kind: string | null
          result: string
          type: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          object_id?: string | null
          object_kind?: string | null
          result?: string
          type: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          object_id?: string | null
          object_kind?: string | null
          result?: string
          type?: string
        }
        Relationships: []
      }
      ai_analyses: {
        Row: {
          created_at: string
          created_by: string | null
          error: string | null
          findings: Json | null
          finished_at: string | null
          id: string
          period_from: string | null
          period_to: string | null
          scope: Json
          source_count: number
          sources_used: Json
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          findings?: Json | null
          finished_at?: string | null
          id?: string
          period_from?: string | null
          period_to?: string | null
          scope?: Json
          source_count?: number
          sources_used?: Json
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          findings?: Json | null
          finished_at?: string | null
          id?: string
          period_from?: string | null
          period_to?: string | null
          scope?: Json
          source_count?: number
          sources_used?: Json
          status?: string
        }
        Relationships: []
      }
      ai_editor_settings: {
        Row: {
          community_decision_note: string
          community_enabled: boolean
          guidelines: string
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          community_decision_note?: string
          community_enabled?: boolean
          guidelines?: string
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          community_decision_note?: string
          community_enabled?: boolean
          guidelines?: string
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_material_versions: {
        Row: {
          actor: string | null
          author: string
          created_at: string
          id: string
          material_id: string
          n: number
          note: string
          snapshot: Json
        }
        Insert: {
          actor?: string | null
          author: string
          created_at?: string
          id?: string
          material_id: string
          n: number
          note?: string
          snapshot: Json
        }
        Update: {
          actor?: string | null
          author?: string
          created_at?: string
          id?: string
          material_id?: string
          n?: number
          note?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_material_versions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "ai_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_materials: {
        Row: {
          created_at: string
          created_by: string | null
          duplicates: Json
          format: string
          handoff_at: string | null
          handoff_id: string | null
          handoff_kind: string | null
          id: string
          last_author: string
          meta: Json
          proposal_id: string | null
          sections: Json
          sources: Json
          status: string
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duplicates?: Json
          format: string
          handoff_at?: string | null
          handoff_id?: string | null
          handoff_kind?: string | null
          id?: string
          last_author?: string
          meta?: Json
          proposal_id?: string | null
          sections?: Json
          sources?: Json
          status?: string
          subtitle?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duplicates?: Json
          format?: string
          handoff_at?: string | null
          handoff_id?: string | null
          handoff_kind?: string | null
          id?: string
          last_author?: string
          meta?: Json
          proposal_id?: string | null
          sections?: Json
          sources?: Json
          status?: string
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_materials_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "ai_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_proposal_events: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          proposal_id: string
          to_status: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          proposal_id: string
          to_status?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          proposal_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_proposal_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "ai_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_proposals: {
        Row: {
          analysis_id: string | null
          created_at: string
          data: Json
          description: string
          expansion: string | null
          format: string
          id: string
          linked_id: string | null
          linked_kind: string | null
          outline: string | null
          reject_reason: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string
          data?: Json
          description?: string
          expansion?: string | null
          format: string
          id?: string
          linked_id?: string | null
          linked_kind?: string | null
          outline?: string | null
          reject_reason?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          analysis_id?: string | null
          created_at?: string
          data?: Json
          description?: string
          expansion?: string | null
          format?: string
          id?: string
          linked_id?: string | null
          linked_kind?: string | null
          outline?: string | null
          reject_reason?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_proposals_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "ai_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_sources: {
        Row: {
          admin_comment: string
          author: string | null
          content: string
          created_at: string
          created_by: string | null
          fetch_error: string | null
          fetch_status: string
          id: string
          kind: string
          published_on: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          admin_comment?: string
          author?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          fetch_error?: string | null
          fetch_status?: string
          id?: string
          kind: string
          published_on?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          admin_comment?: string
          author?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          fetch_error?: string | null
          fetch_status?: string
          id?: string
          kind?: string
          published_on?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      article_ai_origin: {
        Row: {
          article_id: string
          created_by: string | null
          cta: string
          handed_off_at: string
          material_id: string | null
          sources: Json
          tags: string[]
          version_n: number | null
        }
        Insert: {
          article_id: string
          created_by?: string | null
          cta?: string
          handed_off_at?: string
          material_id?: string | null
          sources?: Json
          tags?: string[]
          version_n?: number | null
        }
        Update: {
          article_id?: string
          created_by?: string | null
          cta?: string
          handed_off_at?: string
          material_id?: string | null
          sources?: Json
          tags?: string[]
          version_n?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "article_ai_origin_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: true
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_ai_origin_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "ai_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      article_categories: {
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
      article_comment_guests: {
        Row: {
          comment_id: string
          confirmed_at: string | null
          created_at: string
          email: string
          first_name: string
          ip_hash: string | null
          last_name: string
          last_sent_at: string
          sends: number
          token_expires_at: string | null
          token_hash: string | null
          token_used_at: string | null
        }
        Insert: {
          comment_id: string
          confirmed_at?: string | null
          created_at?: string
          email: string
          first_name: string
          ip_hash?: string | null
          last_name: string
          last_sent_at?: string
          sends?: number
          token_expires_at?: string | null
          token_hash?: string | null
          token_used_at?: string | null
        }
        Update: {
          comment_id?: string
          confirmed_at?: string | null
          created_at?: string
          email?: string
          first_name?: string
          ip_hash?: string | null
          last_name?: string
          last_sent_at?: string
          sends?: number
          token_expires_at?: string | null
          token_hash?: string | null
          token_used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "article_comment_guests_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: true
            referencedRelation: "article_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      article_comment_reports: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reason: string
          reporter_id: string
          status: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_comment_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "article_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      article_comments: {
        Row: {
          article_id: string
          author_id: string | null
          author_name: string
          body: string
          created_at: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          article_id: string
          author_id?: string | null
          author_name?: string
          body: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          article_id?: string
          author_id?: string | null
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_comments_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      article_newsletters: {
        Row: {
          approved_by: string | null
          article_id: string
          created_at: string
          failed_count: number
          intro: string
          last_note: string | null
          mode: string | null
          outro: string
          preheader: string
          prepared_by: string | null
          recipients: number | null
          round: number
          sent_at: string | null
          sent_count: number
          simulated_count: number
          status: string
          subject: string
          teaser: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          article_id: string
          created_at?: string
          failed_count?: number
          intro?: string
          last_note?: string | null
          mode?: string | null
          outro?: string
          preheader?: string
          prepared_by?: string | null
          recipients?: number | null
          round?: number
          sent_at?: string | null
          sent_count?: number
          simulated_count?: number
          status?: string
          subject?: string
          teaser?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          article_id?: string
          created_at?: string
          failed_count?: number
          intro?: string
          last_note?: string | null
          mode?: string | null
          outro?: string
          preheader?: string
          prepared_by?: string | null
          recipients?: number | null
          round?: number
          sent_at?: string | null
          sent_count?: number
          simulated_count?: number
          status?: string
          subject?: string
          teaser?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_newsletters_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: true
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      article_poll_votes: {
        Row: {
          article_id: string
          created_at: string
          option_index: number
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          option_index: number
          user_id?: string
        }
        Update: {
          article_id?: string
          created_at?: string
          option_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_poll_votes_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "article_polls"
            referencedColumns: ["article_id"]
          },
        ]
      }
      article_polls: {
        Row: {
          active: boolean
          article_id: string
          options: Json
          question: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          article_id: string
          options: Json
          question: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          article_id?: string
          options?: Json
          question?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_polls_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: true
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      article_reactions: {
        Row: {
          article_id: string
          created_at: string
          type: string
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          type: string
          user_id?: string
        }
        Update: {
          article_id?: string
          created_at?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_reactions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      article_saves: {
        Row: {
          article_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          user_id?: string
        }
        Update: {
          article_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_saves_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      article_settings: {
        Row: {
          home_mode: string
          id: number
          updated_at: string
        }
        Insert: {
          home_mode?: string
          id?: number
          updated_at?: string
        }
        Update: {
          home_mode?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          author_name: string
          category: string | null
          cover: string | null
          cover_alt: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_prev_status: string | null
          discussion_question: string
          excerpt: string
          featured: boolean
          home_order: number
          id: string
          published_at: string | null
          reading_minutes: number
          reflection_question: string
          sections: Json
          seo_description: string
          seo_title: string
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string
          category?: string | null
          cover?: string | null
          cover_alt?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_prev_status?: string | null
          discussion_question?: string
          excerpt?: string
          featured?: boolean
          home_order?: number
          id?: string
          published_at?: string | null
          reading_minutes?: number
          reflection_question?: string
          sections?: Json
          seo_description?: string
          seo_title?: string
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string
          category?: string | null
          cover?: string | null
          cover_alt?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_prev_status?: string | null
          discussion_question?: string
          excerpt?: string
          featured?: boolean
          home_order?: number
          id?: string
          published_at?: string | null
          reading_minutes?: number
          reflection_question?: string
          sections?: Json
          seo_description?: string
          seo_title?: string
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "article_categories"
            referencedColumns: ["slug"]
          },
        ]
      }
      builder_templates: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          name: string
          scope: string
          sections: Json
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name: string
          scope?: string
          sections?: Json
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name?: string
          scope?: string
          sections?: Json
          updated_at?: string
        }
        Relationships: []
      }
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
      consult_availability: {
        Row: {
          active: boolean
          created_at: string
          end_time: string
          id: string
          start_time: string
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: []
      }
      consult_blocked_dates: {
        Row: {
          created_at: string
          day: string
          reason: string
        }
        Insert: {
          created_at?: string
          day: string
          reason?: string
        }
        Update: {
          created_at?: string
          day?: string
          reason?: string
        }
        Relationships: []
      }
      consult_booking_events: {
        Row: {
          actor: string | null
          booking_id: string
          created_at: string
          detail: string | null
          id: string
          type: string
        }
        Insert: {
          actor?: string | null
          booking_id: string
          created_at?: string
          detail?: string | null
          id?: string
          type: string
        }
        Update: {
          actor?: string | null
          booking_id?: string
          created_at?: string
          detail?: string | null
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "consult_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "consult_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      consult_bookings: {
        Row: {
          access_token: string
          booking_number: string
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          confirmation_error: string | null
          confirmation_status: string
          consent_text: string
          created_at: string
          email: string
          ends_at: string
          first_name: string
          id: string
          last_name: string
          meeting_link: string | null
          phone: string | null
          question: string
          reason: string
          reminder_at: string | null
          reminder_error: string | null
          reminder_status: string
          starts_at: string
          status: string
          status_changed_at: string | null
          status_changed_by: string | null
          topic: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_token?: string
          booking_number?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          confirmation_error?: string | null
          confirmation_status?: string
          consent_text: string
          created_at?: string
          email: string
          ends_at: string
          first_name: string
          id?: string
          last_name: string
          meeting_link?: string | null
          phone?: string | null
          question: string
          reason: string
          reminder_at?: string | null
          reminder_error?: string | null
          reminder_status?: string
          starts_at: string
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          topic: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_token?: string
          booking_number?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          confirmation_error?: string | null
          confirmation_status?: string
          consent_text?: string
          created_at?: string
          email?: string
          ends_at?: string
          first_name?: string
          id?: string
          last_name?: string
          meeting_link?: string | null
          phone?: string | null
          question?: string
          reason?: string
          reminder_at?: string | null
          reminder_error?: string | null
          reminder_status?: string
          starts_at?: string
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          topic?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      consult_settings: {
        Row: {
          default_meeting_link: string | null
          id: number
          updated_at: string
        }
        Insert: {
          default_meeting_link?: string | null
          id?: number
          updated_at?: string
        }
        Update: {
          default_meeting_link?: string | null
          id?: number
          updated_at?: string
        }
        Relationships: []
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
          attempts: number
          created_at: string
          id: string
          idempotency_key: string | null
          kind: string
          mode: string
          payload: Json | null
          provider_message_id: string | null
          reason: string | null
          recipient: string | null
          related_id: string | null
          rendered_html: string | null
          rendered_subject: string | null
          rendered_text: string | null
          retryable: boolean
          status: string
          template_key: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          kind: string
          mode?: string
          payload?: Json | null
          provider_message_id?: string | null
          reason?: string | null
          recipient?: string | null
          related_id?: string | null
          rendered_html?: string | null
          rendered_subject?: string | null
          rendered_text?: string | null
          retryable?: boolean
          status: string
          template_key?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          kind?: string
          mode?: string
          payload?: Json | null
          provider_message_id?: string | null
          reason?: string | null
          recipient?: string | null
          related_id?: string | null
          rendered_html?: string | null
          rendered_subject?: string | null
          rendered_text?: string | null
          retryable?: boolean
          status?: string
          template_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_settings: {
        Row: {
          admin_inbox_url: string | null
          contact_notifications_enabled: boolean
          delivery_mode: string
          id: number
          newsletter_double_opt_in: boolean
          newsletter_notifications_enabled: boolean
          notification_recipient: string | null
          provider: string
          reply_to: string | null
          sender_domain: string | null
          sender_local_part: string
          sender_name: string
          updated_at: string
        }
        Insert: {
          admin_inbox_url?: string | null
          contact_notifications_enabled?: boolean
          delivery_mode?: string
          id?: number
          newsletter_double_opt_in?: boolean
          newsletter_notifications_enabled?: boolean
          notification_recipient?: string | null
          provider?: string
          reply_to?: string | null
          sender_domain?: string | null
          sender_local_part?: string
          sender_name?: string
          updated_at?: string
        }
        Update: {
          admin_inbox_url?: string | null
          contact_notifications_enabled?: boolean
          delivery_mode?: string
          id?: number
          newsletter_double_opt_in?: boolean
          newsletter_notifications_enabled?: boolean
          notification_recipient?: string | null
          provider?: string
          reply_to?: string | null
          sender_domain?: string | null
          sender_local_part?: string
          sender_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          html: string
          key: string
          subject: string
          text_body: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          html: string
          key: string
          subject: string
          text_body: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          html?: string
          key?: string
          subject?: string
          text_body?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      instagram_media: {
        Row: {
          caption: string | null
          id: string
          ig_id: string
          media_type: string
          permalink: string
          posted_at: string
          product_type: string | null
          synced_at: string
          thumbnail_url: string | null
        }
        Insert: {
          caption?: string | null
          id?: string
          ig_id: string
          media_type: string
          permalink: string
          posted_at: string
          product_type?: string | null
          synced_at?: string
          thumbnail_url?: string | null
        }
        Update: {
          caption?: string | null
          id?: string
          ig_id?: string
          media_type?: string
          permalink?: string
          posted_at?: string
          product_type?: string | null
          synced_at?: string
          thumbnail_url?: string | null
        }
        Relationships: []
      }
      instagram_secret: {
        Row: {
          access_token: string | null
          id: number
          oauth_actor: string | null
          oauth_redirect: string | null
          oauth_state: string | null
          oauth_state_expires_at: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          id?: number
          oauth_actor?: string | null
          oauth_redirect?: string | null
          oauth_state?: string | null
          oauth_state_expires_at?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          id?: number
          oauth_actor?: string | null
          oauth_redirect?: string | null
          oauth_state?: string | null
          oauth_state_expires_at?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      instagram_source: {
        Row: {
          connected_at: string | null
          connected_by: string | null
          display_count: number
          id: number
          ig_user_id: string | null
          last_error: string | null
          last_sync_added: number
          last_sync_at: string | null
          media_count: number
          profile_url: string | null
          show_carousels: boolean
          show_posts: boolean
          show_reels: boolean
          status: string
          updated_at: string
          username: string | null
        }
        Insert: {
          connected_at?: string | null
          connected_by?: string | null
          display_count?: number
          id?: number
          ig_user_id?: string | null
          last_error?: string | null
          last_sync_added?: number
          last_sync_at?: string | null
          media_count?: number
          profile_url?: string | null
          show_carousels?: boolean
          show_posts?: boolean
          show_reels?: boolean
          status?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          connected_at?: string | null
          connected_by?: string | null
          display_count?: number
          id?: number
          ig_user_id?: string | null
          last_error?: string | null
          last_sync_added?: number
          last_sync_at?: string | null
          media_count?: number
          profile_url?: string | null
          show_carousels?: boolean
          show_posts?: boolean
          show_reels?: boolean
          status?: string
          updated_at?: string
          username?: string | null
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
          body_updated_at: string | null
          external_url: string | null
          file_name: string | null
          file_path: string | null
          item_id: string
          original_path: string | null
          pdf_generated_at: string | null
          updated_at: string
          watermark_error: string | null
          watermark_source: string | null
          watermark_status: string
        }
        Insert: {
          body?: string
          body_updated_at?: string | null
          external_url?: string | null
          file_name?: string | null
          file_path?: string | null
          item_id: string
          original_path?: string | null
          pdf_generated_at?: string | null
          updated_at?: string
          watermark_error?: string | null
          watermark_source?: string | null
          watermark_status?: string
        }
        Update: {
          body?: string
          body_updated_at?: string | null
          external_url?: string | null
          file_name?: string | null
          file_path?: string | null
          item_id?: string
          original_path?: string | null
          pdf_generated_at?: string | null
          updated_at?: string
          watermark_error?: string | null
          watermark_source?: string | null
          watermark_status?: string
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
          audience: string
          author_name: string
          category: string
          cover_url: string | null
          created_at: string
          created_by: string | null
          currency: string
          delivery_method: string
          free_delivery: string
          id: string
          kind: string
          payment_product_id: string | null
          price_amount: number | null
          published_at: string | null
          purchasable: boolean
          reader_value: string
          sales_description: string
          slug: string
          status: string
          subtitle: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          access?: string
          audience?: string
          author_name?: string
          category: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          delivery_method?: string
          free_delivery?: string
          id?: string
          kind?: string
          payment_product_id?: string | null
          price_amount?: number | null
          published_at?: string | null
          purchasable?: boolean
          reader_value?: string
          sales_description?: string
          slug: string
          status?: string
          subtitle?: string
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          access?: string
          audience?: string
          author_name?: string
          category?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          delivery_method?: string
          free_delivery?: string
          id?: string
          kind?: string
          payment_product_id?: string | null
          price_amount?: number | null
          published_at?: string | null
          purchasable?: boolean
          reader_value?: string
          sales_description?: string
          slug?: string
          status?: string
          subtitle?: string
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
          access_revoked_at: string | null
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
          is_test: boolean
          item_id: string
          order_number: string
          paid_at: string | null
          paid_marked_by: string | null
          payment_method: string
          provider: string | null
          provider_ref: string | null
          refund_reason: string | null
          refunded_at: string | null
          review_reason: string | null
          status: string
          status_changed_at: string | null
          status_changed_by: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_expires_at?: string | null
          access_revoked_at?: string | null
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
          is_test?: boolean
          item_id: string
          order_number?: string
          paid_at?: string | null
          paid_marked_by?: string | null
          payment_method?: string
          provider?: string | null
          provider_ref?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          review_reason?: string | null
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_expires_at?: string | null
          access_revoked_at?: string | null
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
          is_test?: boolean
          item_id?: string
          order_number?: string
          paid_at?: string | null
          paid_marked_by?: string | null
          payment_method?: string
          provider?: string | null
          provider_ref?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          review_reason?: string | null
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
      library_requests: {
        Row: {
          consent_at: string | null
          consent_text: string | null
          created_at: string
          download_count: number
          downloaded_at: string | null
          email: string | null
          first_name: string | null
          id: string
          ip_hash: string | null
          item_id: string
          item_title: string
          last_name: string | null
          mode: string
          notification_log_id: string | null
          notification_status: string | null
          privacy_version: string | null
          retention_until: string
          status: string
          token_expires_at: string | null
          token_hash: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          consent_at?: string | null
          consent_text?: string | null
          created_at?: string
          download_count?: number
          downloaded_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          ip_hash?: string | null
          item_id: string
          item_title: string
          last_name?: string | null
          mode: string
          notification_log_id?: string | null
          notification_status?: string | null
          privacy_version?: string | null
          retention_until?: string
          status: string
          token_expires_at?: string | null
          token_hash?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          consent_at?: string | null
          consent_text?: string | null
          created_at?: string
          download_count?: number
          downloaded_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          ip_hash?: string | null
          item_id?: string
          item_title?: string
          last_name?: string | null
          mode?: string
          notification_log_id?: string | null
          notification_status?: string | null
          privacy_version?: string | null
          retention_until?: string
          status?: string
          token_expires_at?: string | null
          token_hash?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "library_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "library_items"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_registrations: {
        Row: {
          access_token: string
          attended: boolean
          consent_text: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          email: string
          id: string
          meeting_id: string
          message: string | null
          name: string
          phone: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_token?: string
          attended?: boolean
          consent_text: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          email: string
          id?: string
          meeting_id: string
          message?: string | null
          name: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_token?: string
          attended?: boolean
          consent_text?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          email?: string
          id?: string
          meeting_id?: string
          message?: string | null
          name?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_registrations_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          address: string
          cancel_reason: string | null
          cancellation_policy: string
          cancelled_at: string | null
          capacity: number | null
          created_at: string
          created_by: string | null
          description: string
          difficulty: string
          ends_at: string | null
          equipment: string
          fee_info: string
          host: string
          id: string
          image_url: string | null
          is_outdoor: boolean
          join_open_minutes: number
          kind: string
          location: string
          location_public: boolean
          map_url: string | null
          meeting_point: string
          online_link: string | null
          org_notes: string
          organizer_contact: string
          preparation: string
          published_at: string | null
          recording_access: string
          recording_url: string | null
          registration_open: boolean
          requires_approval: boolean
          requires_login: boolean
          route_duration: string
          route_length: string
          rules: string
          slug: string
          starts_at: string
          status: string
          summary: string
          title: string
          updated_at: string
          user_can_cancel: boolean
          venue_name: string
        }
        Insert: {
          address?: string
          cancel_reason?: string | null
          cancellation_policy?: string
          cancelled_at?: string | null
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          difficulty?: string
          ends_at?: string | null
          equipment?: string
          fee_info?: string
          host?: string
          id?: string
          image_url?: string | null
          is_outdoor?: boolean
          join_open_minutes?: number
          kind?: string
          location?: string
          location_public?: boolean
          map_url?: string | null
          meeting_point?: string
          online_link?: string | null
          org_notes?: string
          organizer_contact?: string
          preparation?: string
          published_at?: string | null
          recording_access?: string
          recording_url?: string | null
          registration_open?: boolean
          requires_approval?: boolean
          requires_login?: boolean
          route_duration?: string
          route_length?: string
          rules?: string
          slug: string
          starts_at: string
          status?: string
          summary?: string
          title: string
          updated_at?: string
          user_can_cancel?: boolean
          venue_name?: string
        }
        Update: {
          address?: string
          cancel_reason?: string | null
          cancellation_policy?: string
          cancelled_at?: string | null
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          difficulty?: string
          ends_at?: string | null
          equipment?: string
          fee_info?: string
          host?: string
          id?: string
          image_url?: string | null
          is_outdoor?: boolean
          join_open_minutes?: number
          kind?: string
          location?: string
          location_public?: boolean
          map_url?: string | null
          meeting_point?: string
          online_link?: string | null
          org_notes?: string
          organizer_contact?: string
          preparation?: string
          published_at?: string | null
          recording_access?: string
          recording_url?: string | null
          registration_open?: boolean
          requires_approval?: boolean
          requires_login?: boolean
          route_duration?: string
          route_length?: string
          rules?: string
          slug?: string
          starts_at?: string
          status?: string
          summary?: string
          title?: string
          updated_at?: string
          user_can_cancel?: boolean
          venue_name?: string
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
      notification_rules: {
        Row: {
          enabled: boolean
          event_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled: boolean
          event_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          event_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      payment_providers: {
        Row: {
          client_id: string | null
          enabled: boolean
          environment: string
          id: string
          is_default: boolean
          last_test_at: string | null
          last_test_detail: string | null
          last_test_ok: boolean | null
          merchant_id: string | null
          pos_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          client_id?: string | null
          enabled?: boolean
          environment?: string
          id: string
          is_default?: boolean
          last_test_at?: string | null
          last_test_detail?: string | null
          last_test_ok?: boolean | null
          merchant_id?: string | null
          pos_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          client_id?: string | null
          enabled?: boolean
          environment?: string
          id?: string
          is_default?: boolean
          last_test_at?: string | null
          last_test_detail?: string | null
          last_test_ok?: boolean | null
          merchant_id?: string | null
          pos_id?: string | null
          updated_at?: string
          updated_by?: string | null
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
      platform_settings: {
        Row: {
          brand_settings: Json
          contact_email: string | null
          id: number
          maintenance_enabled: boolean
          maintenance_message: string
          module_visibility: Json
          notice_enabled: boolean
          platform_name: string
          podcast_layout: string
          social_instagram: string | null
          social_spotify: string | null
          social_tiktok: string | null
          social_youtube: string | null
          support_email: string | null
          updated_at: string
          updated_by: string | null
          visual_effects: Json
        }
        Insert: {
          brand_settings?: Json
          contact_email?: string | null
          id?: number
          maintenance_enabled?: boolean
          maintenance_message?: string
          module_visibility?: Json
          notice_enabled?: boolean
          platform_name?: string
          podcast_layout?: string
          social_instagram?: string | null
          social_spotify?: string | null
          social_tiktok?: string | null
          social_youtube?: string | null
          support_email?: string | null
          updated_at?: string
          updated_by?: string | null
          visual_effects?: Json
        }
        Update: {
          brand_settings?: Json
          contact_email?: string | null
          id?: number
          maintenance_enabled?: boolean
          maintenance_message?: string
          module_visibility?: Json
          notice_enabled?: boolean
          platform_name?: string
          podcast_layout?: string
          social_instagram?: string | null
          social_spotify?: string | null
          social_tiktok?: string | null
          social_youtube?: string | null
          support_email?: string | null
          updated_at?: string
          updated_by?: string | null
          visual_effects?: Json
        }
        Relationships: []
      }
      podcast_episodes: {
        Row: {
          access: string
          audio_mime: string | null
          audio_path: string | null
          category: string
          cover_path: string | null
          created_at: string
          created_by: string | null
          description: string
          duration_seconds: number | null
          episode_number: number | null
          external_url: string | null
          featured: boolean
          id: string
          published_at: string | null
          script: string
          slug: string
          sort_order: number
          status: string
          subtitle: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          access?: string
          audio_mime?: string | null
          audio_path?: string | null
          category?: string
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          duration_seconds?: number | null
          episode_number?: number | null
          external_url?: string | null
          featured?: boolean
          id?: string
          published_at?: string | null
          script?: string
          slug: string
          sort_order?: number
          status?: string
          subtitle?: string
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          access?: string
          audio_mime?: string | null
          audio_path?: string | null
          category?: string
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          duration_seconds?: number | null
          episode_number?: number | null
          external_url?: string | null
          featured?: boolean
          id?: string
          published_at?: string | null
          script?: string
          slug?: string
          sort_order?: number
          status?: string
          subtitle?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      podcast_videos: {
        Row: {
          archived_at: string | null
          category: string | null
          created_at: string
          custom_thumbnail_url: string | null
          description: string
          duration_seconds: number | null
          external_url: string | null
          featured: boolean
          id: string
          is_custom_description: boolean
          is_custom_title: boolean
          published_at: string | null
          published_on: string | null
          sort_order: number
          source: string
          status: string
          synced_at: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          youtube_id: string | null
        }
        Insert: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          custom_thumbnail_url?: string | null
          description?: string
          duration_seconds?: number | null
          external_url?: string | null
          featured?: boolean
          id?: string
          is_custom_description?: boolean
          is_custom_title?: boolean
          published_at?: string | null
          published_on?: string | null
          sort_order?: number
          source?: string
          status?: string
          synced_at?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          youtube_id?: string | null
        }
        Update: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          custom_thumbnail_url?: string | null
          description?: string
          duration_seconds?: number | null
          external_url?: string | null
          featured?: boolean
          id?: string
          is_custom_description?: boolean
          is_custom_title?: boolean
          published_at?: string | null
          published_on?: string | null
          sort_order?: number
          source?: string
          status?: string
          synced_at?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          youtube_id?: string | null
        }
        Relationships: []
      }
      site_page_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          page_id: string
          snapshot: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          page_id: string
          snapshot: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          page_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "site_page_versions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "site_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      site_pages: {
        Row: {
          created_at: string
          created_by: string | null
          draft: Json | null
          draft_updated_at: string | null
          id: string
          intro: string
          published_at: string | null
          sections: Json
          seo_description: string
          seo_title: string
          slug: string
          status: string
          system_key: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          draft?: Json | null
          draft_updated_at?: string | null
          id?: string
          intro?: string
          published_at?: string | null
          sections?: Json
          seo_description?: string
          seo_title?: string
          slug: string
          status?: string
          system_key?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          draft?: Json | null
          draft_updated_at?: string | null
          id?: string
          intro?: string
          published_at?: string | null
          sections?: Json
          seo_description?: string
          seo_title?: string
          slug?: string
          status?: string
          system_key?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_identities: {
        Row: {
          created_at: string
          display_mode: string
          tnb_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_mode?: string
          tnb_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_mode?: string
          tnb_id?: string
          updated_at?: string
          user_id?: string
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
      voice_submissions: {
        Row: {
          about: string
          admin_note: string
          contact_consent: boolean
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          profile_url: string | null
          status: string
          story: string
          topic: string
          updated_at: string
          user_id: string | null
          why: string
        }
        Insert: {
          about?: string
          admin_note?: string
          contact_consent: boolean
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          profile_url?: string | null
          status?: string
          story: string
          topic: string
          updated_at?: string
          user_id?: string | null
          why?: string
        }
        Update: {
          about?: string
          admin_note?: string
          contact_consent?: boolean
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          profile_url?: string | null
          status?: string
          story?: string
          topic?: string
          updated_at?: string
          user_id?: string | null
          why?: string
        }
        Relationships: []
      }
      youtube_secret: {
        Row: {
          api_key: string | null
          id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_key?: string | null
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_key?: string | null
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      youtube_source: {
        Row: {
          channel_id: string | null
          channel_input: string | null
          channel_thumb: string | null
          channel_title: string | null
          channel_url: string | null
          id: number
          last_attempt_at: string | null
          last_error: string | null
          last_sync_added: number
          last_sync_at: string | null
          last_sync_report: Json | null
          last_sync_skipped: number
          last_sync_updated: number
          status: string
          updated_at: string
          updated_by: string | null
          uploads_playlist: string | null
          video_count: number
        }
        Insert: {
          channel_id?: string | null
          channel_input?: string | null
          channel_thumb?: string | null
          channel_title?: string | null
          channel_url?: string | null
          id?: number
          last_attempt_at?: string | null
          last_error?: string | null
          last_sync_added?: number
          last_sync_at?: string | null
          last_sync_report?: Json | null
          last_sync_skipped?: number
          last_sync_updated?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          uploads_playlist?: string | null
          video_count?: number
        }
        Update: {
          channel_id?: string | null
          channel_input?: string | null
          channel_thumb?: string | null
          channel_title?: string | null
          channel_url?: string | null
          id?: number
          last_attempt_at?: string | null
          last_error?: string | null
          last_sync_added?: number
          last_sync_at?: string | null
          last_sync_report?: Json | null
          last_sync_skipped?: number
          last_sync_updated?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          uploads_playlist?: string | null
          video_count?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_media_objects: {
        Args: never
        Returns: {
          bucket_id: string
          created_at: string
          mimetype: string
          name: string
          size: number
        }[]
      }
      article_is_public: { Args: { _article: string }; Returns: boolean }
      article_poll_open: {
        Args: { _article: string; _opt: number }
        Returns: boolean
      }
      article_stats: {
        Args: { _article: string }
        Returns: {
          key: string
          kind: string
          n: number
        }[]
      }
      brand_settings_are_public: { Args: { _value: Json }; Returns: boolean }
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
      ensure_identities: { Args: { _ids: string[] }; Returns: undefined }
      ensure_my_identity: {
        Args: never
        Returns: {
          display_mode: string
          display_name: string
          tnb_id: string
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
      set_my_display_mode: { Args: { _mode: string }; Returns: string }
      tnb_display_name: { Args: { _uid: string }; Returns: string }
      tnb_new_id: { Args: never; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "premium"
        | "superadmin"
        | "moderator"
        | "editor"
        | "support"
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
      app_role: [
        "admin",
        "premium",
        "superadmin",
        "moderator",
        "editor",
        "support",
      ],
    },
  },
} as const
