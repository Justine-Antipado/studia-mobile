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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender: Database["public"]["Enums"]["chat_sender"]
          thread_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender: Database["public"]["Enums"]["chat_sender"]
          thread_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender?: Database["public"]["Enums"]["chat_sender"]
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_requests: {
        Row: {
          cost_usd: number | null
          created_at: string
          error_code: string | null
          feature: Database["public"]["Enums"]["ai_feature"]
          id: string
          latency_ms: number | null
          source_id: string | null
          source_type: Database["public"]["Enums"]["ai_source_type"] | null
          status: Database["public"]["Enums"]["ai_status"]
          tokens_in: number | null
          tokens_out: number | null
          user_id: string | null
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string
          error_code?: string | null
          feature: Database["public"]["Enums"]["ai_feature"]
          id?: string
          latency_ms?: number | null
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["ai_source_type"] | null
          status?: Database["public"]["Enums"]["ai_status"]
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string | null
        }
        Update: {
          cost_usd?: number | null
          created_at?: string
          error_code?: string | null
          feature?: Database["public"]["Enums"]["ai_feature"]
          id?: string
          latency_ms?: number | null
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["ai_source_type"] | null
          status?: Database["public"]["Enums"]["ai_status"]
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_comments: {
        Row: {
          announcement_id: string
          author_id: string | null
          body: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          posted_at: string
        }
        Insert: {
          announcement_id: string
          author_id?: string | null
          body: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          posted_at?: string
        }
        Update: {
          announcement_id?: string
          author_id?: string | null
          body?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          posted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_comments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_comments_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string | null
          body: string
          class_id: string
          deleted_at: string | null
          id: string
          pinned: boolean
          posted_at: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          class_id: string
          deleted_at?: string | null
          id?: string
          pinned?: boolean
          posted_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          class_id?: string
          deleted_at?: string | null
          id?: string
          pinned?: boolean
          posted_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_attachments: {
        Row: {
          assignment_id: string
          file_id: string
          position: number
        }
        Insert: {
          assignment_id: string
          file_id: string
          position?: number
        }
        Update: {
          assignment_id?: string
          file_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "assignment_attachments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_attachments_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          assignment_id: string
          created_at: string
          feedback: string | null
          file_id: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          idempotency_key: string | null
          score: number | null
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submission_text: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          feedback?: string | null
          file_id?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          idempotency_key?: string | null
          score?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submission_text?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          feedback?: string | null
          file_id?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          idempotency_key?: string | null
          score?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          submission_text?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          allow_late: boolean
          class_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          due_at: string
          id: string
          instructions: string
          points: number
          title: string
          updated_at: string
        }
        Insert: {
          allow_late?: boolean
          class_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_at: string
          id?: string
          instructions?: string
          points?: number
          title: string
          updated_at?: string
        }
        Update: {
          allow_late?: boolean
          class_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_at?: string
          id?: string
          instructions?: string
          points?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          actor_name: string
          id: string
          ip: unknown
          logged_at: string
          summary: string
          target_ids: Json | null
          target_type: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          actor_name: string
          id?: string
          ip?: unknown
          logged_at?: string
          summary: string
          target_ids?: Json | null
          target_type?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          actor_name?: string
          id?: string
          ip?: unknown
          logged_at?: string
          summary?: string
          target_ids?: Json | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_tokens: {
        Row: {
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          kind: Database["public"]["Enums"]["auth_token_kind"]
          payload: Json | null
          token_hash: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          kind: Database["public"]["Enums"]["auth_token_kind"]
          payload?: Json | null
          token_hash: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["auth_token_kind"]
          payload?: Json | null
          token_hash?: string
        }
        Relationships: []
      }
      backup_runs: {
        Row: {
          finished_at: string | null
          id: string
          note: string | null
          ok: boolean
          size_bytes: number | null
          started_at: string
          triggered_by: string | null
        }
        Insert: {
          finished_at?: string | null
          id?: string
          note?: string | null
          ok?: boolean
          size_bytes?: number | null
          started_at?: string
          triggered_by?: string | null
        }
        Update: {
          finished_at?: string | null
          id?: string
          note?: string | null
          ok?: boolean
          size_bytes?: number | null
          started_at?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "backup_runs_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      class_enrollments: {
        Row: {
          class_id: string
          id: string
          joined_at: string
          left_at: string | null
          student_id: string
        }
        Insert: {
          class_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          student_id: string
        }
        Update: {
          class_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          archived: boolean
          course: Database["public"]["Enums"]["course_code"]
          created_at: string
          deleted_at: string | null
          id: string
          instructor_id: string
          join_code: string
          school_year: string | null
          section: Database["public"]["Enums"]["section_code"]
          semester: string | null
          subject_code: string
          title: string
          updated_at: string
          year_level: Database["public"]["Enums"]["year_level"]
        }
        Insert: {
          archived?: boolean
          course: Database["public"]["Enums"]["course_code"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          instructor_id: string
          join_code?: string
          school_year?: string | null
          section: Database["public"]["Enums"]["section_code"]
          semester?: string | null
          subject_code: string
          title: string
          updated_at?: string
          year_level: Database["public"]["Enums"]["year_level"]
        }
        Update: {
          archived?: boolean
          course?: Database["public"]["Enums"]["course_code"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          instructor_id?: string
          join_code?: string
          school_year?: string | null
          section?: Database["public"]["Enums"]["section_code"]
          semester?: string | null
          subject_code?: string
          title?: string
          updated_at?: string
          year_level?: Database["public"]["Enums"]["year_level"]
        }
        Relationships: [
          {
            foreignKeyName: "classes_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          bucket: string
          checksum_sha256: string | null
          created_at: string
          extension: string
          id: string
          kind: Database["public"]["Enums"]["file_kind"]
          mime_type: string
          object_path: string
          original_name: string
          scan_result: Database["public"]["Enums"]["scan_result"] | null
          scanned_at: string | null
          size_bytes: number
          uploaded_by: string | null
        }
        Insert: {
          bucket: string
          checksum_sha256?: string | null
          created_at?: string
          extension: string
          id?: string
          kind: Database["public"]["Enums"]["file_kind"]
          mime_type: string
          object_path: string
          original_name: string
          scan_result?: Database["public"]["Enums"]["scan_result"] | null
          scanned_at?: string | null
          size_bytes: number
          uploaded_by?: string | null
        }
        Update: {
          bucket?: string
          checksum_sha256?: string | null
          created_at?: string
          extension?: string
          id?: string
          kind?: Database["public"]["Enums"]["file_kind"]
          mime_type?: string
          object_path?: string
          original_name?: string
          scan_result?: Database["public"]["Enums"]["scan_result"] | null
          scanned_at?: string | null
          size_bytes?: number
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string
          endpoint: string
          idem_key: string
          response: Json | null
          status_code: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          idem_key: string
          response?: Json | null
          status_code?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          idem_key?: string
          response?: Json | null
          status_code?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempted_at: string
          id: string
          identifier: string
          ip: unknown
          locked: boolean
          role: Database["public"]["Enums"]["user_role"] | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          attempted_at?: string
          id?: string
          identifier: string
          ip?: unknown
          locked?: boolean
          role?: Database["public"]["Enums"]["user_role"] | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          attempted_at?: string
          id?: string
          identifier?: string
          ip?: unknown
          locked?: boolean
          role?: Database["public"]["Enums"]["user_role"] | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      material_objectives: {
        Row: {
          body: string
          id: string
          material_id: string
          position: number
        }
        Insert: {
          body: string
          id?: string
          material_id: string
          position?: number
        }
        Update: {
          body?: string
          id?: string
          material_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_objectives_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      material_summaries: {
        Row: {
          bullets: Json | null
          generated_at: string
          id: string
          material_id: string
          mindmap: Json | null
          mode: Database["public"]["Enums"]["summary_mode"]
          source_version: number
          tldr: string | null
        }
        Insert: {
          bullets?: Json | null
          generated_at?: string
          id?: string
          material_id: string
          mindmap?: Json | null
          mode: Database["public"]["Enums"]["summary_mode"]
          source_version?: number
          tldr?: string | null
        }
        Update: {
          bullets?: Json | null
          generated_at?: string
          id?: string
          material_id?: string
          mindmap?: Json | null
          mode?: Database["public"]["Enums"]["summary_mode"]
          source_version?: number
          tldr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_summaries_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      material_transcript_lines: {
        Row: {
          body: string
          id: string
          material_id: string
          start_sec: number
        }
        Insert: {
          body: string
          id?: string
          material_id: string
          start_sec: number
        }
        Update: {
          body?: string
          id?: string
          material_id?: string
          start_sec?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_transcript_lines_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      material_views: {
        Row: {
          completed_at: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          material_id: string
          student_id: string
          view_count: number
          watch_seconds: number
        }
        Insert: {
          completed_at?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          material_id: string
          student_id: string
          view_count?: number
          watch_seconds?: number
        }
        Update: {
          completed_at?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          material_id?: string
          student_id?: string
          view_count?: number
          watch_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_views_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_views_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          attempt_count: number
          class_id: string
          deleted_at: string | null
          duration_sec: number | null
          file_id: string | null
          id: string
          kind: Database["public"]["Enums"]["material_kind"]
          owner_id: string | null
          posted_at: string
          processing: Database["public"]["Enums"]["processing_state"]
          processing_error: string | null
          title: string
        }
        Insert: {
          attempt_count?: number
          class_id: string
          deleted_at?: string | null
          duration_sec?: number | null
          file_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["material_kind"]
          owner_id?: string | null
          posted_at?: string
          processing?: Database["public"]["Enums"]["processing_state"]
          processing_error?: string | null
          title: string
        }
        Update: {
          attempt_count?: number
          class_id?: string
          deleted_at?: string | null
          duration_sec?: number | null
          file_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["material_kind"]
          owner_id?: string | null
          posted_at?: string
          processing?: Database["public"]["Enums"]["processing_state"]
          processing_error?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          link_params: Json | null
          link_route: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          link_params?: Json | null
          link_route?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          link_params?: Json | null
          link_route?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          attempts: number
          code_hash: string | null
          consumed_at: string | null
          email: string
          expires_at: string
          id: string
          purpose: Database["public"]["Enums"]["otp_purpose"]
          request_ip: unknown
          sent_at: string
        }
        Insert: {
          attempts?: number
          code_hash?: string | null
          consumed_at?: string | null
          email: string
          expires_at: string
          id?: string
          purpose: Database["public"]["Enums"]["otp_purpose"]
          request_ip?: unknown
          sent_at?: string
        }
        Update: {
          attempts?: number
          code_hash?: string | null
          consumed_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          purpose?: Database["public"]["Enums"]["otp_purpose"]
          request_ip?: unknown
          sent_at?: string
        }
        Relationships: []
      }
      planner_blocks: {
        Row: {
          day_date: string
          done: boolean
          duration_hours: number
          id: string
          start_hour: number
          task_kind: Database["public"]["Enums"]["task_kind"] | null
          task_ref_id: string | null
          title: string
          week_id: string
        }
        Insert: {
          day_date: string
          done?: boolean
          duration_hours?: number
          id?: string
          start_hour: number
          task_kind?: Database["public"]["Enums"]["task_kind"] | null
          task_ref_id?: string | null
          title: string
          week_id: string
        }
        Update: {
          day_date?: string
          done?: boolean
          duration_hours?: number
          id?: string
          start_hour?: number
          task_kind?: Database["public"]["Enums"]["task_kind"] | null
          task_ref_id?: string | null
          title?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_blocks_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "planner_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_exams: {
        Row: {
          created_at: string
          exam_date: string
          id: string
          student_id: string
          title: string
        }
        Insert: {
          created_at?: string
          exam_date: string
          id?: string
          student_id: string
          title: string
        }
        Update: {
          created_at?: string
          exam_date?: string
          id?: string
          student_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_exams_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_weeks: {
        Row: {
          generated_at: string
          id: string
          student_id: string
          week_start: string
        }
        Insert: {
          generated_at?: string
          id?: string
          student_id: string
          week_start: string
        }
        Update: {
          generated_at?: string
          id?: string
          student_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_weeks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_announcements: {
        Row: {
          audience: Database["public"]["Enums"]["announcement_audience"]
          author_id: string | null
          body: string
          course: Database["public"]["Enums"]["course_code"] | null
          created_at: string
          deleted_at: string | null
          id: string
          published_at: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["announcement_status"]
          title: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["announcement_audience"]
          author_id?: string | null
          body: string
          course?: Database["public"]["Enums"]["course_code"] | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["announcement_status"]
          title: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["announcement_audience"]
          author_id?: string | null
          body?: string
          course?: Database["public"]["Enums"]["course_code"] | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["announcement_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_answers: {
        Row: {
          attempt_id: string
          awarded_points: number | null
          id: string
          is_correct: boolean | null
          question_id: string
          response_index: number | null
          response_text: string | null
        }
        Insert: {
          attempt_id: string
          awarded_points?: number | null
          id?: string
          is_correct?: boolean | null
          question_id: string
          response_index?: number | null
          response_text?: string | null
        }
        Update: {
          attempt_id?: string
          awarded_points?: number | null
          id?: string
          is_correct?: boolean | null
          question_id?: string
          response_index?: number | null
          response_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          attempt_no: number
          feedback: string
          graded_at: string | null
          graded_by: string | null
          id: string
          idempotency_key: string | null
          max_score: number
          quiz_id: string
          score: number | null
          started_at: string
          student_id: string
          submitted_at: string | null
        }
        Insert: {
          attempt_no?: number
          feedback?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          idempotency_key?: string | null
          max_score?: number
          quiz_id: string
          score?: number | null
          started_at?: string
          student_id: string
          submitted_at?: string | null
        }
        Update: {
          attempt_no?: number
          feedback?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          idempotency_key?: string | null
          max_score?: number
          quiz_id?: string
          score?: number | null
          started_at?: string
          student_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_options: {
        Row: {
          body: string
          id: string
          position: number
          question_id: string
        }
        Insert: {
          body: string
          id?: string
          position: number
          question_id: string
        }
        Update: {
          body?: string
          id?: string
          position?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_question_keys: {
        Row: {
          correct_answer: string | null
          correct_index: number | null
          question_id: string
          rationale: string | null
        }
        Insert: {
          correct_answer?: string | null
          correct_index?: number | null
          question_id: string
          rationale?: string | null
        }
        Update: {
          correct_answer?: string | null
          correct_index?: number | null
          question_id?: string
          rationale?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_question_keys_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          bloom: Database["public"]["Enums"]["bloom_level"] | null
          concept: string | null
          difficulty: Database["public"]["Enums"]["difficulty_level"] | null
          id: string
          points: number
          position: number
          prompt: string
          quiz_id: string
          type: Database["public"]["Enums"]["question_type"]
        }
        Insert: {
          bloom?: Database["public"]["Enums"]["bloom_level"] | null
          concept?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          id?: string
          points?: number
          position?: number
          prompt: string
          quiz_id: string
          type: Database["public"]["Enums"]["question_type"]
        }
        Update: {
          bloom?: Database["public"]["Enums"]["bloom_level"] | null
          concept?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty_level"] | null
          id?: string
          points?: number
          position?: number
          prompt?: string
          quiz_id?: string
          type?: Database["public"]["Enums"]["question_type"]
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          class_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          due_at: string | null
          id: string
          max_attempts: number
          published_at: string | null
          source: Database["public"]["Enums"]["quiz_source"]
          source_material_id: string | null
          status: Database["public"]["Enums"]["quiz_status"]
          time_limit_min: number | null
          title: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_at?: string | null
          id?: string
          max_attempts?: number
          published_at?: string | null
          source?: Database["public"]["Enums"]["quiz_source"]
          source_material_id?: string | null
          status?: Database["public"]["Enums"]["quiz_status"]
          time_limit_min?: number | null
          title: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_at?: string | null
          id?: string
          max_attempts?: number
          published_at?: string | null
          source?: Database["public"]["Enums"]["quiz_source"]
          source_material_id?: string | null
          status?: Database["public"]["Enums"]["quiz_status"]
          time_limit_min?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_source_material_id_fkey"
            columns: ["source_material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      security_findings: {
        Row: {
          category: string
          description: string
          detected_at: string
          id: string
          recommendation: string
          resolved_at: string | null
          severity: Database["public"]["Enums"]["severity_level"]
          title: string
        }
        Insert: {
          category: string
          description: string
          detected_at?: string
          id?: string
          recommendation: string
          resolved_at?: string | null
          severity: Database["public"]["Enums"]["severity_level"]
          title: string
        }
        Update: {
          category?: string
          description?: string
          detected_at?: string
          id?: string
          recommendation?: string
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["severity_level"]
          title?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          browser: string | null
          created_at: string
          device: string | null
          expires_at: string
          id: string
          ip: unknown
          last_active_at: string
          location: string | null
          platform: Database["public"]["Enums"]["session_platform"]
          revoked_at: string | null
          token_hash: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device?: string | null
          expires_at: string
          id?: string
          ip?: unknown
          last_active_at?: string
          location?: string | null
          platform?: Database["public"]["Enums"]["session_platform"]
          revoked_at?: string | null
          token_hash: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          device?: string | null
          expires_at?: string
          id?: string
          ip?: unknown
          last_active_at?: string
          location?: string | null
          platform?: Database["public"]["Enums"]["session_platform"]
          revoked_at?: string | null
          token_hash?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          data: Json
          section: Database["public"]["Enums"]["settings_section"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          data: Json
          section: Database["public"]["Enums"]["settings_section"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          data?: Json
          section?: Database["public"]["Enums"]["settings_section"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      student_task_overrides: {
        Row: {
          done: boolean
          id: string
          kind: Database["public"]["Enums"]["task_kind"]
          ref_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          done?: boolean
          id?: string
          kind: Database["public"]["Enums"]["task_kind"]
          ref_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          done?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["task_kind"]
          ref_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_task_overrides_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_provider: Database["public"]["Enums"]["auth_provider"]
          course: Database["public"]["Enums"]["course_code"] | null
          created_at: string
          deleted_at: string | null
          department: Database["public"]["Enums"]["department_code"] | null
          email: string
          failed_login_count: number
          full_name: string
          id: string
          last_active_at: string | null
          locked_until: string | null
          phone: string | null
          profile_completed: boolean
          role: Database["public"]["Enums"]["user_role"]
          section: Database["public"]["Enums"]["section_code"] | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          username: string | null
          year_level: Database["public"]["Enums"]["year_level"] | null
        }
        Insert: {
          auth_provider?: Database["public"]["Enums"]["auth_provider"]
          course?: Database["public"]["Enums"]["course_code"] | null
          created_at?: string
          deleted_at?: string | null
          department?: Database["public"]["Enums"]["department_code"] | null
          email: string
          failed_login_count?: number
          full_name: string
          id: string
          last_active_at?: string | null
          locked_until?: string | null
          phone?: string | null
          profile_completed?: boolean
          role: Database["public"]["Enums"]["user_role"]
          section?: Database["public"]["Enums"]["section_code"] | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          username?: string | null
          year_level?: Database["public"]["Enums"]["year_level"] | null
        }
        Update: {
          auth_provider?: Database["public"]["Enums"]["auth_provider"]
          course?: Database["public"]["Enums"]["course_code"] | null
          created_at?: string
          deleted_at?: string | null
          department?: Database["public"]["Enums"]["department_code"] | null
          email?: string
          failed_login_count?: number
          full_name?: string
          id?: string
          last_active_at?: string | null
          locked_until?: string | null
          phone?: string | null
          profile_completed?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          section?: Database["public"]["Enums"]["section_code"] | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          username?: string | null
          year_level?: Database["public"]["Enums"]["year_level"] | null
        }
        Relationships: []
      }
    }
    Views: {
      class_progress: {
        Row: {
          class_id: string | null
          completed_materials: number | null
          progress_pct: number | null
          student_id: string | null
          total_materials: number | null
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      student_tasks: {
        Row: {
          class_id: string | null
          done: boolean | null
          due_at: string | null
          kind: Database["public"]["Enums"]["task_kind"] | null
          ref_id: string | null
          student_id: string | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      join_class: { Args: { p_code: string }; Returns: string }
      leave_class: { Args: { p_class_id: string }; Returns: undefined }
    }
    Enums: {
      account_status: "active" | "inactive" | "pending_approval"
      ai_feature:
        | "summarizer"
        | "planner"
        | "quiz_synthesizer"
        | "chat"
        | "transcription"
      ai_source_type: "material" | "class" | "quiz" | "chat" | "planner"
      ai_status: "ok" | "error" | "timeout"
      announcement_audience: "all" | "students" | "instructors" | "course"
      announcement_status: "scheduled" | "published"
      audit_action: "create" | "update" | "delete" | "settings" | "security"
      auth_provider: "password" | "google"
      auth_token_kind: "reset" | "google_profile"
      bloom_level:
        | "Remember"
        | "Understand"
        | "Apply"
        | "Analyze"
        | "Evaluate"
        | "Create"
      chat_sender: "user" | "ai"
      course_code: "BSIT" | "BEED" | "BSBA-FM" | "BSBA-OM"
      department_code: "FM" | "OM" | "IT" | "ED"
      difficulty_level: "Easy" | "Medium" | "Hard"
      file_kind: "pdf" | "image" | "video" | "doc" | "slide"
      material_kind: "video" | "pdf" | "slide"
      notification_kind:
        | "notice"
        | "quiz"
        | "grade"
        | "lesson"
        | "class"
        | "ai"
        | "reminder"
        | "job"
        | "storage"
        | "security"
      otp_purpose:
        | "signup"
        | "google_login"
        | "google_signup"
        | "reset"
        | "password_change"
      processing_state: "processing" | "ready" | "failed"
      question_type: "multiple_choice" | "identification" | "essay"
      quiz_source: "manual" | "ai"
      quiz_status: "draft" | "published"
      scan_result: "clean" | "infected" | "error"
      section_code: "A" | "B" | "C" | "D" | "E"
      session_platform: "web" | "android" | "ios"
      settings_section:
        | "term"
        | "email"
        | "security_policy"
        | "uploads"
        | "system"
        | "backup"
        | "legal"
        | "ai"
      severity_level: "critical" | "high" | "medium" | "low"
      submission_status: "draft" | "submitted" | "late" | "graded"
      summary_mode: "tldr" | "bullets" | "mindmap"
      task_kind: "assignment" | "quiz"
      user_role: "student" | "instructor" | "admin"
      year_level: "1" | "2" | "3" | "4"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_status: ["active", "inactive", "pending_approval"],
      ai_feature: [
        "summarizer",
        "planner",
        "quiz_synthesizer",
        "chat",
        "transcription",
      ],
      ai_source_type: ["material", "class", "quiz", "chat", "planner"],
      ai_status: ["ok", "error", "timeout"],
      announcement_audience: ["all", "students", "instructors", "course"],
      announcement_status: ["scheduled", "published"],
      audit_action: ["create", "update", "delete", "settings", "security"],
      auth_provider: ["password", "google"],
      auth_token_kind: ["reset", "google_profile"],
      bloom_level: [
        "Remember",
        "Understand",
        "Apply",
        "Analyze",
        "Evaluate",
        "Create",
      ],
      chat_sender: ["user", "ai"],
      course_code: ["BSIT", "BEED", "BSBA-FM", "BSBA-OM"],
      department_code: ["FM", "OM", "IT", "ED"],
      difficulty_level: ["Easy", "Medium", "Hard"],
      file_kind: ["pdf", "image", "video", "doc", "slide"],
      material_kind: ["video", "pdf", "slide"],
      notification_kind: [
        "notice",
        "quiz",
        "grade",
        "lesson",
        "class",
        "ai",
        "reminder",
        "job",
        "storage",
        "security",
      ],
      otp_purpose: [
        "signup",
        "google_login",
        "google_signup",
        "reset",
        "password_change",
      ],
      processing_state: ["processing", "ready", "failed"],
      question_type: ["multiple_choice", "identification", "essay"],
      quiz_source: ["manual", "ai"],
      quiz_status: ["draft", "published"],
      scan_result: ["clean", "infected", "error"],
      section_code: ["A", "B", "C", "D", "E"],
      session_platform: ["web", "android", "ios"],
      settings_section: [
        "term",
        "email",
        "security_policy",
        "uploads",
        "system",
        "backup",
        "legal",
        "ai",
      ],
      severity_level: ["critical", "high", "medium", "low"],
      submission_status: ["draft", "submitted", "late", "graded"],
      summary_mode: ["tldr", "bullets", "mindmap"],
      task_kind: ["assignment", "quiz"],
      user_role: ["student", "instructor", "admin"],
      year_level: ["1", "2", "3", "4"],
    },
  },
} as const
