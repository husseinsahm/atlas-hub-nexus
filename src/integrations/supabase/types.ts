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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_activities: {
        Row: {
          activity_type: string
          booking_id: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          title: string
          user_id: string | null
        }
        Insert: {
          activity_type?: string
          booking_id: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          title: string
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          booking_id?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_activities_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_attachments: {
        Row: {
          booking_id: string
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_attachments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_day_items: {
        Row: {
          booking_day_id: string
          category: string
          created_at: string
          currency: string
          custom_description: string | null
          custom_title: string | null
          duration_minutes: number | null
          id: string
          library_item_id: string | null
          metadata: Json | null
          notes: string | null
          quantity: number
          sort_order: number
          start_time: string | null
          total_price: number | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          booking_day_id: string
          category: string
          created_at?: string
          currency?: string
          custom_description?: string | null
          custom_title?: string | null
          duration_minutes?: number | null
          id?: string
          library_item_id?: string | null
          metadata?: Json | null
          notes?: string | null
          quantity?: number
          sort_order?: number
          start_time?: string | null
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          booking_day_id?: string
          category?: string
          created_at?: string
          currency?: string
          custom_description?: string | null
          custom_title?: string | null
          duration_minutes?: number | null
          id?: string
          library_item_id?: string | null
          metadata?: Json | null
          notes?: string | null
          quantity?: number
          sort_order?: number
          start_time?: string | null
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_day_items_booking_day_id_fkey"
            columns: ["booking_day_id"]
            isOneToOne: false
            referencedRelation: "booking_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_day_items_library_item_id_fkey"
            columns: ["library_item_id"]
            isOneToOne: false
            referencedRelation: "library_items"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_days: {
        Row: {
          booking_id: string
          city: string | null
          created_at: string
          date: string | null
          day_number: number
          description: string | null
          dropoff_location: string | null
          end_time: string | null
          id: string
          internal_notes: string | null
          pickup_location: string | null
          pickup_time: string | null
          short_description: string | null
          start_time: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          booking_id: string
          city?: string | null
          created_at?: string
          date?: string | null
          day_number: number
          description?: string | null
          dropoff_location?: string | null
          end_time?: string | null
          id?: string
          internal_notes?: string | null
          pickup_location?: string | null
          pickup_time?: string | null
          short_description?: string | null
          start_time?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          booking_id?: string
          city?: string | null
          created_at?: string
          date?: string | null
          day_number?: number
          description?: string | null
          dropoff_location?: string | null
          end_time?: string | null
          id?: string
          internal_notes?: string | null
          pickup_location?: string | null
          pickup_time?: string | null
          short_description?: string | null
          start_time?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_days_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_services: {
        Row: {
          booking_id: string
          company_id: string
          confirmation_number: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          dropoff_location: string | null
          duration_minutes: number | null
          end_time: string | null
          id: string
          internal_notes: string | null
          library_item_id: string | null
          location: string | null
          metadata: Json | null
          notes: string | null
          pickup_location: string | null
          quantity: number
          service_date: string | null
          service_type: Database["public"]["Enums"]["service_type"]
          sort_order: number
          start_time: string | null
          status: string
          supplier_contact: string | null
          supplier_name: string | null
          title: string
          total_cost: number | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          booking_id: string
          company_id: string
          confirmation_number?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          dropoff_location?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          internal_notes?: string | null
          library_item_id?: string | null
          location?: string | null
          metadata?: Json | null
          notes?: string | null
          pickup_location?: string | null
          quantity?: number
          service_date?: string | null
          service_type?: Database["public"]["Enums"]["service_type"]
          sort_order?: number
          start_time?: string | null
          status?: string
          supplier_contact?: string | null
          supplier_name?: string | null
          title: string
          total_cost?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          booking_id?: string
          company_id?: string
          confirmation_number?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          dropoff_location?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          internal_notes?: string | null
          library_item_id?: string | null
          location?: string | null
          metadata?: Json | null
          notes?: string | null
          pickup_location?: string | null
          quantity?: number
          service_date?: string | null
          service_type?: Database["public"]["Enums"]["service_type"]
          sort_order?: number
          start_time?: string | null
          status?: string
          supplier_contact?: string | null
          supplier_name?: string | null
          title?: string
          total_cost?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_services_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_services_library_item_id_fkey"
            columns: ["library_item_id"]
            isOneToOne: false
            referencedRelation: "library_items"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_travelers: {
        Row: {
          booking_id: string
          company_id: string
          created_at: string
          date_of_birth: string | null
          dietary_restrictions: string | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          is_adult: boolean | null
          is_lead_traveler: boolean | null
          metadata: Json | null
          nationality: string | null
          passport_country: string | null
          passport_expiry: string | null
          passport_number: string | null
          phone: string | null
          room_preference: string | null
          special_requirements: string | null
          updated_at: string
          visa_expiry: string | null
          visa_number: string | null
        }
        Insert: {
          booking_id: string
          company_id: string
          created_at?: string
          date_of_birth?: string | null
          dietary_restrictions?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          is_adult?: boolean | null
          is_lead_traveler?: boolean | null
          metadata?: Json | null
          nationality?: string | null
          passport_country?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          phone?: string | null
          room_preference?: string | null
          special_requirements?: string | null
          updated_at?: string
          visa_expiry?: string | null
          visa_number?: string | null
        }
        Update: {
          booking_id?: string
          company_id?: string
          created_at?: string
          date_of_birth?: string | null
          dietary_restrictions?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          is_adult?: boolean | null
          is_lead_traveler?: boolean | null
          metadata?: Json | null
          nationality?: string | null
          passport_country?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          phone?: string | null
          room_preference?: string | null
          special_requirements?: string | null
          updated_at?: string
          visa_expiry?: string | null
          visa_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_travelers_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_travelers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          adults: number
          amount_paid: number | null
          arrival_date: string | null
          assigned_to: string | null
          booking_number: string
          children: number
          client_notes: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          deleted_at: string | null
          departure_date: string | null
          description: string | null
          end_date: string | null
          id: string
          internal_notes: string | null
          itinerary_notes: string | null
          lead_id: string | null
          operations_notes: string | null
          payment_status: string
          selling_price: number | null
          service_notes: string | null
          source: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["booking_status"]
          title: string
          total_cost: number | null
          total_days: number
          travelers: Json | null
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          adults?: number
          amount_paid?: number | null
          arrival_date?: string | null
          assigned_to?: string | null
          booking_number: string
          children?: number
          client_notes?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          deleted_at?: string | null
          departure_date?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          internal_notes?: string | null
          itinerary_notes?: string | null
          lead_id?: string | null
          operations_notes?: string | null
          payment_status?: string
          selling_price?: number | null
          service_notes?: string | null
          source?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          title: string
          total_cost?: number | null
          total_days?: number
          travelers?: Json | null
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          adults?: number
          amount_paid?: number | null
          arrival_date?: string | null
          assigned_to?: string | null
          booking_number?: string
          children?: number
          client_notes?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          deleted_at?: string | null
          departure_date?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          internal_notes?: string | null
          itinerary_notes?: string | null
          lead_id?: string | null
          operations_notes?: string | null
          payment_status?: string
          selling_price?: number | null
          service_notes?: string | null
          source?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          title?: string
          total_cost?: number | null
          total_days?: number
          travelers?: Json | null
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          phone: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_branches: {
        Row: {
          address: string | null
          city: string | null
          company_id: string
          country: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean
          is_main: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_main?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_main?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_memberships: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          booking_next_number: number
          booking_prefix: string
          company_id: string
          created_at: string
          default_currency: string
          default_language: string
          id: string
          invoice_next_number: number
          invoice_prefix: string
          logo_url: string | null
          quotation_next_number: number
          quotation_prefix: string
          supported_languages: Json
          tagline: string | null
          trip_next_number: number
          trip_prefix: string
          updated_at: string
          website: string | null
        }
        Insert: {
          booking_next_number?: number
          booking_prefix?: string
          company_id: string
          created_at?: string
          default_currency?: string
          default_language?: string
          id?: string
          invoice_next_number?: number
          invoice_prefix?: string
          logo_url?: string | null
          quotation_next_number?: number
          quotation_prefix?: string
          supported_languages?: Json
          tagline?: string | null
          trip_next_number?: number
          trip_prefix?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          booking_next_number?: number
          booking_prefix?: string
          company_id?: string
          created_at?: string
          default_currency?: string
          default_language?: string
          id?: string
          invoice_next_number?: number
          invoice_prefix?: string
          logo_url?: string | null
          quotation_next_number?: number
          quotation_prefix?: string
          supported_languages?: Json
          tagline?: string | null
          trip_next_number?: number
          trip_prefix?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_attachments: {
        Row: {
          created_at: string
          customer_id: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_attachments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          content: string
          created_at: string
          customer_id: string
          id: string
          metadata: Json | null
          note_type: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          customer_id: string
          id?: string
          metadata?: Json | null
          note_type?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          customer_id?: string
          id?: string
          metadata?: Json | null
          note_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          avatar_url: string | null
          city: string | null
          company_id: string
          country: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          deleted_at: string | null
          email: string | null
          full_name: string
          id: string
          lead_id: string | null
          nationality: string | null
          notes: string | null
          passport_number: string | null
          phone: string | null
          preferences: Json | null
          secondary_phone: string | null
          source: string | null
          tags: Json | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          company_id: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          lead_id?: string | null
          nationality?: string | null
          notes?: string | null
          passport_number?: string | null
          phone?: string | null
          preferences?: Json | null
          secondary_phone?: string | null
          source?: string | null
          tags?: Json | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          company_id?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          lead_id?: string | null
          nationality?: string | null
          notes?: string | null
          passport_number?: string | null
          phone?: string | null
          preferences?: Json | null
          secondary_phone?: string | null
          source?: string | null
          tags?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_attachments: {
        Row: {
          category: string
          company_id: string
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string
          company_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_comments: {
        Row: {
          company_id: string
          content: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          mentions: string[] | null
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          mentions?: string[] | null
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          mentions?: string[] | null
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_comments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "internal_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_templates: {
        Row: {
          company_id: string
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          destinations: Json | null
          id: string
          is_active: boolean | null
          tags: Json | null
          title: string
          total_days: number
          updated_at: string
        }
        Insert: {
          company_id: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          destinations?: Json | null
          id?: string
          is_active?: boolean | null
          tags?: Json | null
          title: string
          total_days?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          destinations?: Json | null
          id?: string
          is_active?: boolean | null
          tags?: Json | null
          title?: string
          total_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          activity_type: string
          created_at: string
          description: string
          id: string
          lead_id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string
          description: string
          id?: string
          lead_id: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string
          id?: string
          lead_id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_followups: {
        Row: {
          assigned_to: string | null
          company_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expected_outcome: string | null
          followup_type: string
          id: string
          is_completed: boolean
          is_recurring: boolean
          lead_id: string
          metadata: Json | null
          priority: string
          recurrence_pattern: string | null
          scheduled_date: string
          scheduled_time: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_outcome?: string | null
          followup_type?: string
          id?: string
          is_completed?: boolean
          is_recurring?: boolean
          lead_id: string
          metadata?: Json | null
          priority?: string
          recurrence_pattern?: string | null
          scheduled_date: string
          scheduled_time?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_outcome?: string | null
          followup_type?: string
          id?: string
          is_completed?: boolean
          is_recurring?: boolean
          lead_id?: string
          metadata?: Json | null
          priority?: string
          recurrence_pattern?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_followups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          adults: number
          assigned_to: string | null
          budget_currency: string
          budget_max: number | null
          budget_min: number | null
          children: number
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          destinations: Json | null
          email: string | null
          full_name: string
          id: string
          nationality: string | null
          notes: string | null
          phone: string | null
          preferred_language: string | null
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          travel_date: string | null
          trip_type: string | null
          updated_at: string
          urgency: string | null
          whatsapp: string | null
        }
        Insert: {
          adults?: number
          assigned_to?: string | null
          budget_currency?: string
          budget_max?: number | null
          budget_min?: number | null
          children?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          destinations?: Json | null
          email?: string | null
          full_name: string
          id?: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          preferred_language?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          travel_date?: string | null
          trip_type?: string | null
          updated_at?: string
          urgency?: string | null
          whatsapp?: string | null
        }
        Update: {
          adults?: number
          assigned_to?: string | null
          budget_currency?: string
          budget_max?: number | null
          budget_min?: number | null
          children?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          destinations?: Json | null
          email?: string | null
          full_name?: string
          id?: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          preferred_language?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          travel_date?: string | null
          trip_type?: string | null
          updated_at?: string
          urgency?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      library_items: {
        Row: {
          category: Database["public"]["Enums"]["library_category"]
          city: string | null
          company_id: string
          country: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          internal_notes: string | null
          is_active: boolean
          is_template: boolean
          metadata: Json | null
          photos: Json | null
          price_amount: number | null
          price_currency: string
          price_type: string
          tags: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["library_category"]
          city?: string | null
          company_id: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          internal_notes?: string | null
          is_active?: boolean
          is_template?: boolean
          metadata?: Json | null
          photos?: Json | null
          price_amount?: number | null
          price_currency?: string
          price_type?: string
          tags?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["library_category"]
          city?: string | null
          company_id?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          internal_notes?: string | null
          is_active?: boolean
          is_template?: boolean
          metadata?: Json | null
          photos?: Json | null
          price_amount?: number | null
          price_currency?: string
          price_type?: string
          tags?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          company_id: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          is_reminder: boolean
          message: string | null
          metadata: Json | null
          reminder_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          is_reminder?: boolean
          message?: string | null
          metadata?: Json | null
          reminder_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          is_reminder?: boolean
          message?: string | null
          metadata?: Json | null
          reminder_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_records: {
        Row: {
          amount: number
          booking_id: string
          company_id: string
          created_at: string
          currency: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          recorded_by: string | null
          reference_number: string | null
        }
        Insert: {
          amount?: number
          booking_id: string
          company_id: string
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          recorded_by?: string | null
          reference_number?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          company_id?: string
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          recorded_by?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean
          max_branches: number | null
          max_trips: number | null
          max_users: number | null
          name: string
          price_monthly: number
          price_yearly: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          max_branches?: number | null
          max_trips?: number | null
          max_users?: number | null
          name: string
          price_monthly?: number
          price_yearly?: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          max_branches?: number | null
          max_trips?: number | null
          max_users?: number | null
          name?: string
          price_monthly?: number
          price_yearly?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          preferred_language: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_language?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_language?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quotations: {
        Row: {
          accepted_at: string | null
          client_notes: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          deleted_at: string | null
          deposit_amount: number | null
          deposit_percentage: number | null
          discount_amount: number | null
          id: string
          lead_id: string | null
          notes: string | null
          payment_terms: string | null
          quotation_number: string
          sent_at: string | null
          status: Database["public"]["Enums"]["quotation_status"]
          subtotal: number | null
          terms_and_conditions: string | null
          total_amount: number | null
          trip_id: string | null
          trip_snapshot: Json | null
          updated_at: string
          valid_until: string | null
          validity_days: number
        }
        Insert: {
          accepted_at?: string | null
          client_notes?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          deleted_at?: string | null
          deposit_amount?: number | null
          deposit_percentage?: number | null
          discount_amount?: number | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          payment_terms?: string | null
          quotation_number: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number | null
          terms_and_conditions?: string | null
          total_amount?: number | null
          trip_id?: string | null
          trip_snapshot?: Json | null
          updated_at?: string
          valid_until?: string | null
          validity_days?: number
        }
        Update: {
          accepted_at?: string | null
          client_notes?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          deleted_at?: string | null
          deposit_amount?: number | null
          deposit_percentage?: number | null
          discount_amount?: number | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          payment_terms?: string | null
          quotation_number?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number | null
          terms_and_conditions?: string | null
          total_amount?: number | null
          trip_id?: string | null
          trip_snapshot?: Json | null
          updated_at?: string
          valid_until?: string | null
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          canceled_at: string | null
          company_id: string
          created_at: string
          created_by: string | null
          current_period_end: string
          current_period_start: string
          id: string
          payment_status: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          trial_starts_at: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          canceled_at?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          payment_status?: string
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          canceled_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          payment_status?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      template_day_items: {
        Row: {
          category: string
          created_at: string
          currency: string
          custom_description: string | null
          custom_title: string | null
          duration_minutes: number | null
          id: string
          library_item_id: string | null
          metadata: Json | null
          notes: string | null
          quantity: number
          sort_order: number
          start_time: string | null
          template_day_id: string
          total_price: number | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          currency?: string
          custom_description?: string | null
          custom_title?: string | null
          duration_minutes?: number | null
          id?: string
          library_item_id?: string | null
          metadata?: Json | null
          notes?: string | null
          quantity?: number
          sort_order?: number
          start_time?: string | null
          template_day_id: string
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          currency?: string
          custom_description?: string | null
          custom_title?: string | null
          duration_minutes?: number | null
          id?: string
          library_item_id?: string | null
          metadata?: Json | null
          notes?: string | null
          quantity?: number
          sort_order?: number
          start_time?: string | null
          template_day_id?: string
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_day_items_library_item_id_fkey"
            columns: ["library_item_id"]
            isOneToOne: false
            referencedRelation: "library_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_day_items_template_day_id_fkey"
            columns: ["template_day_id"]
            isOneToOne: false
            referencedRelation: "template_days"
            referencedColumns: ["id"]
          },
        ]
      }
      template_days: {
        Row: {
          city: string | null
          created_at: string
          day_number: number
          description: string | null
          id: string
          template_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          day_number: number
          description?: string | null
          id?: string
          template_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          day_number?: number
          description?: string | null
          id?: string
          template_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_days_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "itinerary_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_day_items: {
        Row: {
          category: string
          created_at: string
          currency: string
          custom_description: string | null
          custom_title: string | null
          duration_minutes: number | null
          id: string
          library_item_id: string | null
          metadata: Json | null
          notes: string | null
          quantity: number
          sort_order: number
          start_time: string | null
          total_price: number | null
          trip_day_id: string
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          currency?: string
          custom_description?: string | null
          custom_title?: string | null
          duration_minutes?: number | null
          id?: string
          library_item_id?: string | null
          metadata?: Json | null
          notes?: string | null
          quantity?: number
          sort_order?: number
          start_time?: string | null
          total_price?: number | null
          trip_day_id: string
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          currency?: string
          custom_description?: string | null
          custom_title?: string | null
          duration_minutes?: number | null
          id?: string
          library_item_id?: string | null
          metadata?: Json | null
          notes?: string | null
          quantity?: number
          sort_order?: number
          start_time?: string | null
          total_price?: number | null
          trip_day_id?: string
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_day_items_library_item_id_fkey"
            columns: ["library_item_id"]
            isOneToOne: false
            referencedRelation: "library_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_day_items_trip_day_id_fkey"
            columns: ["trip_day_id"]
            isOneToOne: false
            referencedRelation: "trip_days"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_days: {
        Row: {
          city: string | null
          created_at: string
          date: string | null
          day_number: number
          description: string | null
          id: string
          title: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          date?: string | null
          day_number: number
          description?: string | null
          id?: string
          title?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          date?: string | null
          day_number?: number
          description?: string | null
          id?: string
          title?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_days_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_feedback: {
        Row: {
          client_email: string | null
          client_name: string
          created_at: string
          feedback_type: string
          id: string
          message: string | null
          status: string
          trip_id: string
        }
        Insert: {
          client_email?: string | null
          client_name: string
          created_at?: string
          feedback_type?: string
          id?: string
          message?: string | null
          status?: string
          trip_id: string
        }
        Update: {
          client_email?: string | null
          client_name?: string
          created_at?: string
          feedback_type?: string
          id?: string
          message?: string | null
          status?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_feedback_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_revisions: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          id: string
          note: string | null
          revision_number: number
          snapshot: Json | null
          summary: string
          trip_id: string
          user_id: string | null
        }
        Insert: {
          action?: string
          changes?: Json | null
          created_at?: string
          id?: string
          note?: string | null
          revision_number?: number
          snapshot?: Json | null
          summary: string
          trip_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          id?: string
          note?: string | null
          revision_number?: number
          snapshot?: Json | null
          summary?: string
          trip_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_revisions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          adults: number
          assigned_to: string | null
          children: number
          client_notes: string | null
          company_id: string
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          deleted_at: string | null
          description: string | null
          discount_type: string
          discount_value: number | null
          end_date: string | null
          id: string
          internal_notes: string | null
          lead_id: string | null
          markup_type: string
          markup_value: number | null
          pricing_notes: string | null
          profit_margin: number | null
          selling_price: number | null
          share_token: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["trip_status"]
          title: string
          total_cost: number | null
          total_days: number
          trip_number: string
          updated_at: string
        }
        Insert: {
          adults?: number
          assigned_to?: string | null
          children?: number
          client_notes?: string | null
          company_id: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          deleted_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number | null
          end_date?: string | null
          id?: string
          internal_notes?: string | null
          lead_id?: string | null
          markup_type?: string
          markup_value?: number | null
          pricing_notes?: string | null
          profit_margin?: number | null
          selling_price?: number | null
          share_token?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          title: string
          total_cost?: number | null
          total_days?: number
          trip_number: string
          updated_at?: string
        }
        Update: {
          adults?: number
          assigned_to?: string | null
          children?: number
          client_notes?: string | null
          company_id?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          deleted_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number | null
          end_date?: string | null
          id?: string
          internal_notes?: string | null
          lead_id?: string | null
          markup_type?: string
          markup_value?: number | null
          pricing_notes?: string | null
          profit_margin?: number | null
          selling_price?: number | null
          share_token?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          title?: string
          total_cost?: number | null
          total_days?: number
          trip_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_company_role: {
        Args: { _company_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      soft_delete_customer: { Args: { _customer_id: string }; Returns: boolean }
      soft_delete_lead: { Args: { _lead_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "company_admin"
        | "agent"
        | "operations"
        | "finance"
        | "viewer"
      booking_status:
        | "tentative"
        | "confirmed"
        | "in_operation"
        | "completed"
        | "cancelled"
      lead_source:
        | "website"
        | "referral"
        | "social_media"
        | "walk_in"
        | "phone"
        | "email"
        | "partner"
        | "other"
      lead_status:
        | "new"
        | "contacted"
        | "planning"
        | "awaiting_client"
        | "won"
        | "lost"
      library_category:
        | "attraction"
        | "hotel"
        | "activity"
        | "transfer"
        | "meal"
        | "guide"
        | "template"
      quotation_status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "expired"
        | "cancelled"
      service_type:
        | "hotel"
        | "transfer"
        | "tour"
        | "guide"
        | "meal"
        | "activity"
        | "other"
        | "flight"
        | "visa"
        | "entrance"
      trip_status:
        | "draft"
        | "under_review"
        | "awaiting_approval"
        | "approved"
        | "converted"
        | "cancelled"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
        "super_admin",
        "company_admin",
        "agent",
        "operations",
        "finance",
        "viewer",
      ],
      booking_status: [
        "tentative",
        "confirmed",
        "in_operation",
        "completed",
        "cancelled",
      ],
      lead_source: [
        "website",
        "referral",
        "social_media",
        "walk_in",
        "phone",
        "email",
        "partner",
        "other",
      ],
      lead_status: [
        "new",
        "contacted",
        "planning",
        "awaiting_client",
        "won",
        "lost",
      ],
      library_category: [
        "attraction",
        "hotel",
        "activity",
        "transfer",
        "meal",
        "guide",
        "template",
      ],
      quotation_status: [
        "draft",
        "sent",
        "accepted",
        "rejected",
        "expired",
        "cancelled",
      ],
      service_type: [
        "hotel",
        "transfer",
        "tour",
        "guide",
        "meal",
        "activity",
        "other",
        "flight",
        "visa",
        "entrance",
      ],
      trip_status: [
        "draft",
        "under_review",
        "awaiting_approval",
        "approved",
        "converted",
        "cancelled",
      ],
    },
  },
} as const
