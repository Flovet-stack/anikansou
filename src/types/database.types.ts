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
    PostgrestVersion: "14.18"
  }
  catalog: {
    Tables: {
      anime: {
        Row: {
          content_hash: string
          created_at: string
          duration_seconds: number | null
          episodes: number | null
          first_seen_run_id: number
          id: number
          last_changed_run_id: number
          retired_at: string | null
          season: Database["catalog"]["Enums"]["season"] | null
          status: Database["catalog"]["Enums"]["anime_status"] | null
          title: string
          type: Database["catalog"]["Enums"]["anime_type"] | null
          updated_at: string
          year: number | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          duration_seconds?: number | null
          episodes?: number | null
          first_seen_run_id: number
          id?: number
          last_changed_run_id: number
          retired_at?: string | null
          season?: Database["catalog"]["Enums"]["season"] | null
          status?: Database["catalog"]["Enums"]["anime_status"] | null
          title: string
          type?: Database["catalog"]["Enums"]["anime_type"] | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          duration_seconds?: number | null
          episodes?: number | null
          first_seen_run_id?: number
          id?: number
          last_changed_run_id?: number
          retired_at?: string | null
          season?: Database["catalog"]["Enums"]["season"] | null
          status?: Database["catalog"]["Enums"]["anime_status"] | null
          title?: string
          type?: Database["catalog"]["Enums"]["anime_type"] | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "anime_first_seen_run_id_fkey"
            columns: ["first_seen_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anime_last_changed_run_id_fkey"
            columns: ["last_changed_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      anime_images: {
        Row: {
          anime_id: number
          created_at: string
          external_ref: string | null
          height: number | null
          id: number
          kind: string
          note: string | null
          source_id: number
          status: string
          storage_path: string | null
          updated_at: string
          url: string | null
          width: number | null
        }
        Insert: {
          anime_id: number
          created_at?: string
          external_ref?: string | null
          height?: number | null
          id?: never
          kind?: string
          note?: string | null
          source_id: number
          status?: string
          storage_path?: string | null
          updated_at?: string
          url?: string | null
          width?: number | null
        }
        Update: {
          anime_id?: number
          created_at?: string
          external_ref?: string | null
          height?: number | null
          id?: never
          kind?: string
          note?: string | null
          source_id?: number
          status?: string
          storage_path?: string | null
          updated_at?: string
          url?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "anime_images_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anime_images_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "image_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      anime_redirects: {
        Row: {
          created_at: string
          created_run_id: number
          from_anime_id: number
          reason: string
          to_anime_id: number
        }
        Insert: {
          created_at?: string
          created_run_id: number
          from_anime_id: number
          reason: string
          to_anime_id: number
        }
        Update: {
          created_at?: string
          created_run_id?: number
          from_anime_id?: number
          reason?: string
          to_anime_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "anime_redirects_created_run_id_fkey"
            columns: ["created_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anime_redirects_from_anime_id_fkey"
            columns: ["from_anime_id"]
            isOneToOne: true
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anime_redirects_to_anime_id_fkey"
            columns: ["to_anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
        ]
      }
      anime_relations: {
        Row: {
          anime_id: number
          related_anime_id: number
        }
        Insert: {
          anime_id: number
          related_anime_id: number
        }
        Update: {
          anime_id?: number
          related_anime_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "anime_relations_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anime_relations_related_anime_id_fkey"
            columns: ["related_anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
        ]
      }
      anime_scores: {
        Row: {
          anime_id: number
          arithmetic_geometric_mean: number
          arithmetic_mean: number
          median: number
        }
        Insert: {
          anime_id: number
          arithmetic_geometric_mean: number
          arithmetic_mean: number
          median: number
        }
        Update: {
          anime_id?: number
          arithmetic_geometric_mean?: number
          arithmetic_mean?: number
          median?: number
        }
        Relationships: [
          {
            foreignKeyName: "anime_scores_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: true
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
        ]
      }
      anime_source_records: {
        Row: {
          anime_id: number
          content_hash: string
          payload: Json
        }
        Insert: {
          anime_id: number
          content_hash: string
          payload: Json
        }
        Update: {
          anime_id?: number
          content_hash?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "anime_source_records_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: true
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
        ]
      }
      anime_studios: {
        Row: {
          anime_id: number
          role: Database["catalog"]["Enums"]["studio_role"]
          studio_id: number
        }
        Insert: {
          anime_id: number
          role: Database["catalog"]["Enums"]["studio_role"]
          studio_id: number
        }
        Update: {
          anime_id?: number
          role?: Database["catalog"]["Enums"]["studio_role"]
          studio_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "anime_studios_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anime_studios_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      anime_tags: {
        Row: {
          anime_id: number
          tag_id: number
        }
        Insert: {
          anime_id: number
          tag_id: number
        }
        Update: {
          anime_id?: number
          tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "anime_tags_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anime_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      anime_titles: {
        Row: {
          anime_id: number
          id: number
          kind: Database["catalog"]["Enums"]["title_kind"]
          lang: string | null
          search_text: string
          title: string
        }
        Insert: {
          anime_id: number
          id?: never
          kind: Database["catalog"]["Enums"]["title_kind"]
          lang?: string | null
          search_text: string
          title: string
        }
        Update: {
          anime_id?: number
          id?: never
          kind?: Database["catalog"]["Enums"]["title_kind"]
          lang?: string | null
          search_text?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "anime_titles_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
        ]
      }
      data_sources: {
        Row: {
          attribution: string
          created_at: string
          data_type: string
          id: number
          is_active: boolean
          licence: string
          name: string
          priority: number
          slug: string
          url: string
        }
        Insert: {
          attribution: string
          created_at?: string
          data_type: string
          id?: never
          is_active?: boolean
          licence: string
          name: string
          priority?: number
          slug: string
          url: string
        }
        Update: {
          attribution?: string
          created_at?: string
          data_type?: string
          id?: never
          is_active?: boolean
          licence?: string
          name?: string
          priority?: number
          slug?: string
          url?: string
        }
        Relationships: []
      }
      external_ids: {
        Row: {
          anime_id: number
          external_id: string
          site: string
          url: string
        }
        Insert: {
          anime_id: number
          external_id: string
          site: string
          url: string
        }
        Update: {
          anime_id?: number
          external_id?: string
          site?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_ids_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
        ]
      }
      image_sources: {
        Row: {
          attribution: string
          created_at: string
          id: number
          is_enabled: boolean
          name: string
          priority: number
          slug: string
          url_prefix: string | null
        }
        Insert: {
          attribution?: string
          created_at?: string
          id?: never
          is_enabled?: boolean
          name: string
          priority: number
          slug: string
          url_prefix?: string | null
        }
        Update: {
          attribution?: string
          created_at?: string
          id?: never
          is_enabled?: boolean
          name?: string
          priority?: number
          slug?: string
          url_prefix?: string | null
        }
        Relationships: []
      }
      import_runs: {
        Row: {
          data_source_id: number
          details: Json | null
          entry_count: number | null
          error: string | null
          finished_at: string | null
          git_commit: string | null
          id: number
          inserted: number | null
          merged: number | null
          release_tag: string
          retired: number | null
          revived: number | null
          sha256: string
          split: number | null
          started_at: string
          status: Database["catalog"]["Enums"]["run_status"]
          trigger: Database["catalog"]["Enums"]["run_trigger"]
          unchanged: number | null
          unresolved_relations: number | null
          updated: number | null
        }
        Insert: {
          data_source_id: number
          details?: Json | null
          entry_count?: number | null
          error?: string | null
          finished_at?: string | null
          git_commit?: string | null
          id?: never
          inserted?: number | null
          merged?: number | null
          release_tag: string
          retired?: number | null
          revived?: number | null
          sha256: string
          split?: number | null
          started_at?: string
          status?: Database["catalog"]["Enums"]["run_status"]
          trigger: Database["catalog"]["Enums"]["run_trigger"]
          unchanged?: number | null
          unresolved_relations?: number | null
          updated?: number | null
        }
        Update: {
          data_source_id?: number
          details?: Json | null
          entry_count?: number | null
          error?: string | null
          finished_at?: string | null
          git_commit?: string | null
          id?: never
          inserted?: number | null
          merged?: number | null
          release_tag?: string
          retired?: number | null
          revived?: number | null
          sha256?: string
          split?: number | null
          started_at?: string
          status?: Database["catalog"]["Enums"]["run_status"]
          trigger?: Database["catalog"]["Enums"]["run_trigger"]
          unchanged?: number | null
          unresolved_relations?: number | null
          updated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_runs_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      overrides: {
        Row: {
          anime_id: number
          created_at: string
          created_by: string
          field: string
          id: number
          reason: string
          value: Json
        }
        Insert: {
          anime_id: number
          created_at?: string
          created_by: string
          field: string
          id?: never
          reason: string
          value: Json
        }
        Update: {
          anime_id?: number
          created_at?: string
          created_by?: string
          field?: string
          id?: never
          reason?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "overrides_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
        ]
      }
      staging_anime: {
        Row: {
          anime_id: number
          content_hash: string
          duration_seconds: number | null
          episodes: number | null
          payload: Json
          score_agm: number | null
          score_mean: number | null
          score_median: number | null
          season: Database["catalog"]["Enums"]["season"] | null
          status: Database["catalog"]["Enums"]["anime_status"] | null
          title: string
          type: Database["catalog"]["Enums"]["anime_type"] | null
          year: number | null
        }
        Insert: {
          anime_id: number
          content_hash: string
          duration_seconds?: number | null
          episodes?: number | null
          payload: Json
          score_agm?: number | null
          score_mean?: number | null
          score_median?: number | null
          season?: Database["catalog"]["Enums"]["season"] | null
          status?: Database["catalog"]["Enums"]["anime_status"] | null
          title: string
          type?: Database["catalog"]["Enums"]["anime_type"] | null
          year?: number | null
        }
        Update: {
          anime_id?: number
          content_hash?: string
          duration_seconds?: number | null
          episodes?: number | null
          payload?: Json
          score_agm?: number | null
          score_mean?: number | null
          score_median?: number | null
          season?: Database["catalog"]["Enums"]["season"] | null
          status?: Database["catalog"]["Enums"]["anime_status"] | null
          title?: string
          type?: Database["catalog"]["Enums"]["anime_type"] | null
          year?: number | null
        }
        Relationships: []
      }
      staging_anime_studios: {
        Row: {
          anime_id: number
          raw_name: string
          role: Database["catalog"]["Enums"]["studio_role"]
        }
        Insert: {
          anime_id: number
          raw_name: string
          role: Database["catalog"]["Enums"]["studio_role"]
        }
        Update: {
          anime_id?: number
          raw_name?: string
          role?: Database["catalog"]["Enums"]["studio_role"]
        }
        Relationships: []
      }
      staging_anime_tags: {
        Row: {
          anime_id: number
          tag: string
        }
        Insert: {
          anime_id: number
          tag: string
        }
        Update: {
          anime_id?: number
          tag?: string
        }
        Relationships: []
      }
      staging_external_ids: {
        Row: {
          anime_id: number
          external_id: string
          site: string
          url: string
        }
        Insert: {
          anime_id: number
          external_id: string
          site: string
          url: string
        }
        Update: {
          anime_id?: number
          external_id?: string
          site?: string
          url?: string
        }
        Relationships: []
      }
      staging_merges: {
        Row: {
          from_anime_id: number
          to_anime_id: number
        }
        Insert: {
          from_anime_id: number
          to_anime_id: number
        }
        Update: {
          from_anime_id?: number
          to_anime_id?: number
        }
        Relationships: []
      }
      staging_relations: {
        Row: {
          anime_id: number
          external_id: string
          site: string
        }
        Insert: {
          anime_id: number
          external_id: string
          site: string
        }
        Update: {
          anime_id?: number
          external_id?: string
          site?: string
        }
        Relationships: []
      }
      staging_retired: {
        Row: {
          anime_id: number
        }
        Insert: {
          anime_id: number
        }
        Update: {
          anime_id?: number
        }
        Relationships: []
      }
      staging_studio_aliases: {
        Row: {
          key: string
          raw_name: string
        }
        Insert: {
          key: string
          raw_name: string
        }
        Update: {
          key?: string
          raw_name?: string
        }
        Relationships: []
      }
      staging_studios: {
        Row: {
          key: string
          name: string
        }
        Insert: {
          key: string
          name: string
        }
        Update: {
          key?: string
          name?: string
        }
        Relationships: []
      }
      staging_titles: {
        Row: {
          anime_id: number
          kind: Database["catalog"]["Enums"]["title_kind"]
          search_text: string
          title: string
        }
        Insert: {
          anime_id: number
          kind: Database["catalog"]["Enums"]["title_kind"]
          search_text: string
          title: string
        }
        Update: {
          anime_id?: number
          kind?: Database["catalog"]["Enums"]["title_kind"]
          search_text?: string
          title?: string
        }
        Relationships: []
      }
      studio_aliases: {
        Row: {
          raw_name: string
          source: Database["catalog"]["Enums"]["alias_source"]
          studio_id: number
        }
        Insert: {
          raw_name: string
          source?: Database["catalog"]["Enums"]["alias_source"]
          studio_id: number
        }
        Update: {
          raw_name?: string
          source?: Database["catalog"]["Enums"]["alias_source"]
          studio_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "studio_aliases_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studios: {
        Row: {
          id: number
          key: string
          name: string
        }
        Insert: {
          id?: never
          key: string
          name: string
        }
        Update: {
          id?: never
          key?: string
          name?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: never
          name: string
        }
        Update: {
          id?: never
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      poster_candidates: {
        Row: {
          anime_id: number | null
          height: number | null
          priority: number | null
          source: string | null
          storage_path: string | null
          url: string | null
          width: number | null
        }
        Relationships: [
          {
            foreignKeyName: "anime_images_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "anime"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_adult: { Args: { p_anime_id: number }; Returns: boolean }
    }
    Enums: {
      alias_source: "import" | "override"
      anime_status: "finished" | "ongoing" | "upcoming"
      anime_type: "tv" | "movie" | "ova" | "ona" | "special"
      run_status: "running" | "succeeded" | "failed"
      run_trigger: "schedule" | "push" | "manual"
      season: "winter" | "spring" | "summer" | "fall"
      studio_role: "studio" | "producer"
      title_kind: "main" | "synonym"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      deck_order_state: {
        Row: {
          id: number
          import_run_id: number | null
          refreshed_at: string
        }
        Insert: {
          id?: number
          import_run_id?: number | null
          refreshed_at?: string
        }
        Update: {
          id?: number
          import_run_id?: number | null
          refreshed_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      user_anime: {
        Row: {
          anime_id: number
          created_at: string
          liked: boolean
          rating: number | null
          status: Database["public"]["Enums"]["watch_status"] | null
          updated_at: string
          user_id: string
          watchlisted: boolean
        }
        Insert: {
          anime_id: number
          created_at?: string
          liked?: boolean
          rating?: number | null
          status?: Database["public"]["Enums"]["watch_status"] | null
          updated_at?: string
          user_id: string
          watchlisted?: boolean
        }
        Update: {
          anime_id?: number
          created_at?: string
          liked?: boolean
          rating?: number | null
          status?: Database["public"]["Enums"]["watch_status"] | null
          updated_at?: string
          user_id?: string
          watchlisted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_anime_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "deck_order"
            referencedColumns: ["anime_id"]
          },
        ]
      }
      user_anime_events: {
        Row: {
          anime_id: number
          created_at: string
          id: number
          kind: Database["public"]["Enums"]["tracking_event_kind"]
          source: string
          user_id: string
          value: Json
        }
        Insert: {
          anime_id: number
          created_at?: string
          id?: never
          kind: Database["public"]["Enums"]["tracking_event_kind"]
          source?: string
          user_id: string
          value?: Json
        }
        Update: {
          anime_id?: number
          created_at?: string
          id?: never
          kind?: Database["public"]["Enums"]["tracking_event_kind"]
          source?: string
          user_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "user_anime_events_anime_id_fkey"
            columns: ["anime_id"]
            isOneToOne: false
            referencedRelation: "deck_order"
            referencedColumns: ["anime_id"]
          },
        ]
      }
    }
    Views: {
      deck_order: {
        Row: {
          aired: boolean | null
          anime_id: number | null
          rank: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      deck_excluded: {
        Args: { p_anime_id: number; p_user: string }
        Returns: boolean
      }
      deck_next: {
        Args: { p_after?: number; p_page_size?: number }
        Returns: {
          anime_id: number
          duration_seconds: number
          episodes: number
          is_adult: boolean
          is_upcoming: boolean
          native_title: string
          season: Database["catalog"]["Enums"]["season"]
          studios: string[]
          tags: string[]
          title: string
          type: Database["catalog"]["Enums"]["anime_type"]
          year: number
        }[]
      }
      deck_order_refresh_if_stale: { Args: never; Returns: undefined }
      deck_seen: {
        Args: {
          p_anime_id: number
          p_rating: number
          p_status: Database["public"]["Enums"]["watch_status"]
        }
        Returns: Json
      }
      deck_skip: { Args: { p_anime_id: number; p_via: string }; Returns: Json }
      deck_undo: { Args: { p_event_id: number }; Returns: Json }
      library_counts: {
        Args: never
        Returns: {
          count: number
          shelf: string
        }[]
      }
      library_page: {
        Args: {
          p_cursor?: Json
          p_page_size?: number
          p_shelf: string
          p_sort?: string
        }
        Returns: {
          anime_id: number
          cursor: Json
          duration_seconds: number
          episodes: number
          is_upcoming: boolean
          liked: boolean
          native_title: string
          rating: number
          status: Database["public"]["Enums"]["watch_status"]
          title: string
          type: Database["catalog"]["Enums"]["anime_type"]
          watchlisted: boolean
          year: number
        }[]
      }
      library_remove: { Args: { p_anime_id: number }; Returns: Json }
      search_anime: {
        Args: { p_limit?: number; p_offset?: number; p_query: string }
        Returns: {
          anime_id: number
          duration_seconds: number
          episodes: number
          is_adult: boolean
          is_upcoming: boolean
          liked: boolean
          matched_title: string
          native_title: string
          rating: number
          status: Database["public"]["Enums"]["watch_status"]
          title: string
          total: number
          type: Database["catalog"]["Enums"]["anime_type"]
          watchlisted: boolean
          year: number
        }[]
      }
      set_like: {
        Args: { p_anime_id: number; p_liked: boolean }
        Returns: Json
      }
      set_rating: {
        Args: { p_anime_id: number; p_rating: number }
        Returns: Json
      }
      set_status: {
        Args: {
          p_anime_id: number
          p_status: Database["public"]["Enums"]["watch_status"]
        }
        Returns: Json
      }
      set_watchlist: {
        Args: { p_anime_id: number; p_on: boolean }
        Returns: Json
      }
      tracking_apply: {
        Args: {
          p_anime_id: number
          p_extra?: Json
          p_kind: Database["public"]["Enums"]["tracking_event_kind"]
          p_liked: boolean
          p_rating: number
          p_status: Database["public"]["Enums"]["watch_status"]
          p_watchlisted: boolean
        }
        Returns: Json
      }
      tracking_current: {
        Args: { p_anime_id: number }
        Returns: {
          anime_id: number
          created_at: string
          liked: boolean
          rating: number | null
          status: Database["public"]["Enums"]["watch_status"] | null
          updated_at: string
          user_id: string
          watchlisted: boolean
        }
        SetofOptions: {
          from: "*"
          to: "user_anime"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      tracking_lock: {
        Args: { p_anime_id: number; p_user: string }
        Returns: undefined
      }
      tracking_state: {
        Args: { p_row: Database["public"]["Tables"]["user_anime"]["Row"] }
        Returns: Json
      }
    }
    Enums: {
      tracking_event_kind:
        | "status_set"
        | "status_cleared"
        | "rated"
        | "rating_cleared"
        | "liked"
        | "unliked"
        | "watchlist_added"
        | "watchlist_removed"
        | "deck_skipped"
        | "undone"
      watch_status: "watched" | "watching" | "on_hold" | "dropped"
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
  catalog: {
    Enums: {
      alias_source: ["import", "override"],
      anime_status: ["finished", "ongoing", "upcoming"],
      anime_type: ["tv", "movie", "ova", "ona", "special"],
      run_status: ["running", "succeeded", "failed"],
      run_trigger: ["schedule", "push", "manual"],
      season: ["winter", "spring", "summer", "fall"],
      studio_role: ["studio", "producer"],
      title_kind: ["main", "synonym"],
    },
  },
  public: {
    Enums: {
      tracking_event_kind: [
        "status_set",
        "status_cleared",
        "rated",
        "rating_cleared",
        "liked",
        "unliked",
        "watchlist_added",
        "watchlist_removed",
        "deck_skipped",
        "undone",
      ],
      watch_status: ["watched", "watching", "on_hold", "dropped"],
    },
  },
} as const
