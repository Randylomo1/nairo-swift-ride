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
      coverage_areas: {
        Row: {
          active: boolean
          id: string
          lat: number | null
          lng: number | null
          name: string
        }
        Insert: {
          active?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
        }
        Update: {
          active?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
        }
        Relationships: []
      }
      delivery_proofs: {
        Row: {
          delivered_at: string
          gps_lat: number | null
          gps_lng: number | null
          id: string
          notes: string | null
          order_id: string
          photo_url: string | null
          recipient_name: string | null
          signature_url: string | null
        }
        Insert: {
          delivered_at?: string
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          notes?: string | null
          order_id: string
          photo_url?: string | null
          recipient_name?: string | null
          signature_url?: string | null
        }
        Update: {
          delivered_at?: string
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          notes?: string | null
          order_id?: string
          photo_url?: string | null
          recipient_name?: string | null
          signature_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_stops: {
        Row: {
          address: string
          id: string
          lat: number
          lng: number
          order_id: string
          recipient_name: string | null
          recipient_phone: string | null
          stop_order: number
        }
        Insert: {
          address: string
          id?: string
          lat: number
          lng: number
          order_id: string
          recipient_name?: string | null
          recipient_phone?: string | null
          stop_order: number
        }
        Update: {
          address?: string
          id?: string
          lat?: number
          lng?: number
          order_id?: string
          recipient_name?: string | null
          recipient_phone?: string | null
          stop_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_stops_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string
          delivery_type: Database["public"]["Enums"]["delivery_type"]
          distance_km: number
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          eta_minutes: number
          fare_kes: number
          fragile: boolean
          id: string
          mpesa_checkout_request_id: string | null
          mpesa_receipt: string | null
          notes: string | null
          order_number: string
          package_category: string | null
          package_size: string | null
          package_weight_kg: number
          payment_status: Database["public"]["Enums"]["payment_status"]
          pickup_address: string
          pickup_contact_name: string
          pickup_lat: number
          pickup_lng: number
          pickup_phone: string
          recipient_name: string
          recipient_phone: string
          rider_id: string | null
          scheduled_for: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          distance_km?: number
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          eta_minutes?: number
          fare_kes?: number
          fragile?: boolean
          id?: string
          mpesa_checkout_request_id?: string | null
          mpesa_receipt?: string | null
          notes?: string | null
          order_number?: string
          package_category?: string | null
          package_size?: string | null
          package_weight_kg?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_address: string
          pickup_contact_name: string
          pickup_lat: number
          pickup_lng: number
          pickup_phone: string
          recipient_name: string
          recipient_phone: string
          rider_id?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          distance_km?: number
          dropoff_address?: string
          dropoff_lat?: number
          dropoff_lng?: number
          eta_minutes?: number
          fare_kes?: number
          fragile?: boolean
          id?: string
          mpesa_checkout_request_id?: string | null
          mpesa_receipt?: string | null
          notes?: string | null
          order_number?: string
          package_category?: string | null
          package_size?: string | null
          package_weight_kg?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_address?: string
          pickup_contact_name?: string
          pickup_lat?: number
          pickup_lng?: number
          pickup_phone?: string
          recipient_name?: string
          recipient_phone?: string
          rider_id?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_kes: number
          checkout_request_id: string | null
          created_at: string
          customer_id: string
          id: string
          merchant_request_id: string | null
          mpesa_receipt: string | null
          order_id: string
          phone: string
          result_desc: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_kes: number
          checkout_request_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt?: string | null
          order_id: string
          phone: string
          result_desc?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_kes?: number
          checkout_request_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          merchant_request_id?: string | null
          mpesa_receipt?: string | null
          order_id?: string
          phone?: string
          result_desc?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          credits_kes: number
          email: string | null
          full_name: string
          id: string
          phone: string | null
          referral_code: string | null
          referred_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits_kes?: number
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits_kes?: number
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      riders: {
        Row: {
          approved: boolean
          bike_registration: string | null
          created_at: string
          current_lat: number | null
          current_lng: number | null
          id: string
          id_photo_url: string | null
          license_number: string | null
          license_photo_url: string | null
          national_id: string | null
          online: boolean
          rating: number | null
          total_deliveries: number
          updated_at: string
        }
        Insert: {
          approved?: boolean
          bike_registration?: string | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          id: string
          id_photo_url?: string | null
          license_number?: string | null
          license_photo_url?: string | null
          national_id?: string | null
          online?: boolean
          rating?: number | null
          total_deliveries?: number
          updated_at?: string
        }
        Update: {
          approved?: boolean
          bike_registration?: string | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          id?: string
          id_photo_url?: string | null
          license_number?: string | null
          license_photo_url?: string | null
          national_id?: string | null
          online?: boolean
          rating?: number | null
          total_deliveries?: number
          updated_at?: string
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
      claim_first_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "customer" | "rider" | "admin"
      delivery_type: "standard" | "express" | "same_day" | "scheduled"
      order_status:
        | "created"
        | "payment_pending"
        | "paid"
        | "rider_assigned"
        | "heading_to_pickup"
        | "picked_up"
        | "in_transit"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
      payment_status: "pending" | "success" | "failed"
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
      app_role: ["customer", "rider", "admin"],
      delivery_type: ["standard", "express", "same_day", "scheduled"],
      order_status: [
        "created",
        "payment_pending",
        "paid",
        "rider_assigned",
        "heading_to_pickup",
        "picked_up",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      payment_status: ["pending", "success", "failed"],
    },
  },
} as const
