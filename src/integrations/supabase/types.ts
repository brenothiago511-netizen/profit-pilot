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
      alert_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          store_id: string | null
          threshold: number | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          store_id?: string | null
          threshold?: number | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          store_id?: string | null
          threshold?: number | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_holder: string
          account_number: string
          account_type: string
          balance: number
          bank_name: string
          country: string
          created_at: string
          created_by: string | null
          currency: string
          iban: string | null
          id: string
          is_primary: boolean
          notes: string | null
          routing_number: string | null
          status: string
          store_id: string | null
          swift_code: string | null
          updated_at: string
        }
        Insert: {
          account_holder: string
          account_number: string
          account_type?: string
          balance?: number
          bank_name: string
          country?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          iban?: string | null
          id?: string
          is_primary?: boolean
          notes?: string | null
          routing_number?: string | null
          status?: string
          store_id?: string | null
          swift_code?: string | null
          updated_at?: string
        }
        Update: {
          account_holder?: string
          account_number?: string
          account_type?: string
          balance?: number
          bank_name?: string
          country?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          iban?: string | null
          id?: string
          is_primary?: boolean
          notes?: string | null
          routing_number?: string | null
          status?: string
          store_id?: string | null
          swift_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          bank_account_id: string
          category: string | null
          created_at: string
          created_by: string | null
          date: string
          description: string
          id: string
          notes: string | null
          reference_id: string | null
          reference_type: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          bank_account_id: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          bank_account_id?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      captador_commissions: {
        Row: {
          commission_rate: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          commission_rate?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          commission_rate?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      commission_tiers: {
        Row: {
          active: boolean | null
          commission_percentage: number
          created_at: string | null
          id: string
          max_profit: number | null
          min_profit: number
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          commission_percentage: number
          created_at?: string | null
          id?: string
          max_profit?: number | null
          min_profit: number
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          commission_percentage?: number
          created_at?: string | null
          id?: string
          max_profit?: number | null
          min_profit?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      commissions: {
        Row: {
          base_amount: number
          commission_amount: number
          created_at: string
          id: string
          manager_id: string
          paid_at: string | null
          percent: number
          period_end: string
          period_start: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          base_amount: number
          commission_amount: number
          created_at?: string
          id?: string
          manager_id: string
          paid_at?: string | null
          percent: number
          period_end: string
          period_start: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          base_amount?: number
          commission_amount?: number
          created_at?: string
          id?: string
          manager_id?: string
          paid_at?: string | null
          percent?: number
          period_end?: string
          period_start?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_records: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          created_by: string | null
          daily_profit: number
          date: string
          id: string
          manager_id: string
          notes: string | null
          shopify_deposit_1: number | null
          shopify_deposit_1_converted: number | null
          shopify_deposit_1_currency: string | null
          shopify_deposit_1_number: string | null
          shopify_deposit_1_rate: number | null
          shopify_deposit_2: number | null
          shopify_deposit_2_converted: number | null
          shopify_deposit_2_currency: string | null
          shopify_deposit_2_number: string | null
          shopify_deposit_2_rate: number | null
          shopify_status: string | null
          status: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          daily_profit: number
          date: string
          id?: string
          manager_id: string
          notes?: string | null
          shopify_deposit_1?: number | null
          shopify_deposit_1_converted?: number | null
          shopify_deposit_1_currency?: string | null
          shopify_deposit_1_number?: string | null
          shopify_deposit_1_rate?: number | null
          shopify_deposit_2?: number | null
          shopify_deposit_2_converted?: number | null
          shopify_deposit_2_currency?: string | null
          shopify_deposit_2_number?: string | null
          shopify_deposit_2_rate?: number | null
          shopify_status?: string | null
          status?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          created_by?: string | null
          daily_profit?: number
          date?: string
          id?: string
          manager_id?: string
          notes?: string | null
          shopify_deposit_1?: number | null
          shopify_deposit_1_converted?: number | null
          shopify_deposit_1_currency?: string | null
          shopify_deposit_1_number?: string | null
          shopify_deposit_1_rate?: number | null
          shopify_deposit_2?: number | null
          shopify_deposit_2_converted?: number | null
          shopify_deposit_2_currency?: string | null
          shopify_deposit_2_number?: string | null
          shopify_deposit_2_rate?: number | null
          shopify_status?: string | null
          status?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_records_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_records_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          base_currency: string
          created_at: string
          date: string
          id: string
          rate: number
          source: string
          target_currency: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          date?: string
          id?: string
          rate: number
          source?: string
          target_currency: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          date?: string
          id?: string
          rate?: number
          source?: string
          target_currency?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          ai_extracted: boolean
          amount: number
          category_id: string | null
          converted_amount: number | null
          created_at: string
          date: string
          description: string
          exchange_rate_used: number | null
          id: string
          image_url: string | null
          original_amount: number | null
          original_currency: string | null
          payment_method: string | null
          store_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_extracted?: boolean
          amount: number
          category_id?: string | null
          converted_amount?: number | null
          created_at?: string
          date?: string
          description: string
          exchange_rate_used?: number | null
          id?: string
          image_url?: string | null
          original_amount?: number | null
          original_currency?: string | null
          payment_method?: string | null
          store_id?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_extracted?: boolean
          amount?: number
          category_id?: string | null
          converted_amount?: number | null
          created_at?: string
          date?: string
          description?: string
          exchange_rate_used?: number | null
          id?: string
          image_url?: string | null
          original_amount?: number | null
          original_currency?: string | null
          payment_method?: string | null
          store_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      managers: {
        Row: {
          commission_percent: number
          commission_type: string
          created_at: string
          id: string
          status: string
          store_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          commission_percent?: number
          commission_type?: string
          created_at?: string
          id?: string
          status?: string
          store_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          commission_percent?: number
          commission_type?: string
          created_at?: string
          id?: string
          status?: string
          store_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "managers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          id: string
          partner_id: string
          store_id: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          partner_id: string
          store_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          partner_id?: string
          store_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_transactions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          capital_amount: number
          capital_percentage: number
          created_at: string
          id: string
          status: string
          store_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          capital_amount?: number
          capital_percentage?: number
          created_at?: string
          id?: string
          status?: string
          store_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          capital_amount?: number
          capital_percentage?: number
          created_at?: string
          id?: string
          status?: string
          store_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partners_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          employee_name: string
          id: string
          payment_day: number
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          employee_name: string
          id?: string
          payment_day: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          employee_name?: string
          id?: string
          payment_day?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payroll_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          date: string
          id: string
          notes: string | null
          payroll_id: string
          receipt_url: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string | null
          payroll_id: string
          receipt_url?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string | null
          payroll_id?: string
          receipt_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_payments_payroll_id_fkey"
            columns: ["payroll_id"]
            isOneToOne: false
            referencedRelation: "payroll"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          key: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          id?: string
          key: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          key?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_custom_permissions: boolean
          name: string
          preferred_currency: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          is_custom_permissions?: boolean
          name: string
          preferred_currency?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_custom_permissions?: boolean
          name?: string
          preferred_currency?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profits: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          id: string
          manager_id: string
          notes: string | null
          period_end: string
          period_start: string
          profit_amount: number
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          id?: string
          manager_id: string
          notes?: string | null
          period_end: string
          period_start: string
          profit_amount: number
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          id?: string
          manager_id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          profit_amount?: number
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profits_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_goals: {
        Row: {
          created_at: string
          created_by: string | null
          exchange_rate_used: number | null
          goal_amount_converted: number | null
          goal_amount_original: number
          goal_currency: string
          id: string
          partner_id: string | null
          period_end: string
          period_start: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          exchange_rate_used?: number | null
          goal_amount_converted?: number | null
          goal_amount_original: number
          goal_currency?: string
          id?: string
          partner_id?: string | null
          period_end: string
          period_start: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          exchange_rate_used?: number | null
          goal_amount_converted?: number | null
          goal_amount_original?: number
          goal_currency?: string
          id?: string
          partner_id?: string | null
          period_end?: string
          period_start?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_goals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_goals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      revenues: {
        Row: {
          amount: number
          converted_amount: number | null
          created_at: string
          date: string
          exchange_rate_used: number | null
          id: string
          image_url: string | null
          manager_id: string | null
          notes: string | null
          original_amount: number | null
          original_currency: string | null
          payment_method: string | null
          source: string | null
          store_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          converted_amount?: number | null
          created_at?: string
          date?: string
          exchange_rate_used?: number | null
          id?: string
          image_url?: string | null
          manager_id?: string | null
          notes?: string | null
          original_amount?: number | null
          original_currency?: string | null
          payment_method?: string | null
          source?: string | null
          store_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          converted_amount?: number | null
          created_at?: string
          date?: string
          exchange_rate_used?: number | null
          id?: string
          image_url?: string | null
          manager_id?: string | null
          notes?: string | null
          original_amount?: number | null
          original_currency?: string | null
          payment_method?: string | null
          source?: string | null
          store_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenues_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenues_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_withdrawals: {
        Row: {
          amount: number
          converted_amount: number | null
          created_at: string
          created_by: string | null
          currency: string
          date: string
          exchange_rate_used: number | null
          id: string
          notes: string | null
          received_at: string | null
          sale_date: string | null
          status: string
          store_name: string
          updated_at: string
        }
        Insert: {
          amount: number
          converted_amount?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          exchange_rate_used?: number | null
          id?: string
          notes?: string | null
          received_at?: string | null
          sale_date?: string | null
          status?: string
          store_name: string
          updated_at?: string
        }
        Update: {
          amount?: number
          converted_amount?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          exchange_rate_used?: number | null
          id?: string
          notes?: string | null
          received_at?: string | null
          sale_date?: string | null
          status?: string
          store_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_bank_accounts: {
        Row: {
          bank_account_id: string
          created_at: string
          id: string
          is_primary: boolean
          store_id: string
        }
        Insert: {
          bank_account_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          store_id: string
        }
        Update: {
          bank_account_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_bank_accounts_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_bank_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_roi_alerts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          roi_threshold: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          roi_threshold?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          roi_threshold?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_roi_alerts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          country: string
          created_at: string
          currency: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          country?: string
          created_at?: string
          currency?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          currency?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          id: string
          permission_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          id?: string
          permission_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          id?: string
          permission_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
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
      user_stores: {
        Row: {
          created_at: string
          id: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_exchange_rate: {
        Args: {
          p_base_currency: string
          p_date?: string
          p_target_currency: string
        }
        Returns: number
      }
      get_expense_summary: {
        Args: { p_date_from: string; p_date_to: string; p_user_id?: string }
        Returns: {
          category_name: string
          total_amount: number
        }[]
      }
      get_partner_store_ids: { Args: { _user_id: string }; Returns: string[] }
      get_profile_by_id: { Args: { p_user_id: string }; Returns: Json }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_permission:
        | {
            Args: { _permission_key: string; _user_id: string }
            Returns: boolean
          }
        | {
            Args: { _permission_key: string; _user_id: string }
            Returns: boolean
          }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_admin_or_financeiro: { Args: { _user_id: string }; Returns: boolean }
      is_partner: { Args: { _user_id: string }; Returns: boolean }
      sum_amounts: {
        Args: {
          p_date_end: string
          p_date_start: string
          p_include_null_store?: boolean
          p_store_ids?: string[]
          p_table: string
          p_user_id?: string
        }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "financeiro" | "gestor" | "socio" | "captador"
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
      app_role: ["admin", "financeiro", "gestor", "socio", "captador"],
    },
  },
} as const
