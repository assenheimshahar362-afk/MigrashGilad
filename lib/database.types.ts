/**
 * Supabase schema types for the `public` schema, in the shape
 * `supabase gen types typescript` emits. Regenerate against a live database
 * with:
 *
 *   supabase gen types typescript --local > lib/database.types.ts
 *
 * Supplying this as the `Database` generic to every Supabase client is what
 * makes `.from('events').select()` return `EventRow` instead of `never`, and it
 * turns a column rename in a migration into a compile error rather than a
 * runtime `undefined`.
 */
import type {
  AccessRequestRow,
  AccessRequestStatus,
  AdminRole,
  BookingRequestRow,
  ClosureRow,
  EventRow,
  ManagerRow,
  OpeningHours,
  RecurringRuleRow,
  RequestStatus,
  SiteSettingsRow,
  TrusteeRow,
  UsageType,
} from '@/lib/types';

type Insertable<T, Optional extends keyof T> = Omit<T, Optional> & Partial<Pick<T, Optional>>;

/**
 * Declared as a `type`, not an `interface`, deliberately. supabase-js constrains
 * the generic to `Record<string, GenericSchema>`; only object *type aliases*
 * receive an implicit index signature, so an interface here silently fails the
 * constraint and every query degrades to `never` with no error at the
 * declaration site.
 */
export type Database = {
  public: {
    Tables: {
      site_settings: {
        Row: SiteSettingsRow;
        Insert: Insertable<SiteSettingsRow, 'updated_by' | 'updated_at'>;
        Update: Partial<Omit<SiteSettingsRow, 'id'>>;
        Relationships: [];
      };
      admin_allowlist: {
        Row: ManagerRow;
        Insert: Insertable<
          ManagerRow,
          'id' | 'full_name' | 'role' | 'notify_email' | 'notify_push' | 'phone_e164' | 'created_at' | 'revoked_at'
        > & { created_by?: string | null };
        Update: Partial<ManagerRow> & { created_by?: string | null };
        Relationships: [];
      };
      admin_profiles: {
        Row: {
          user_id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          last_seen: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          last_seen?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          user_id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          last_seen: string | null;
        }>;
        Relationships: [];
      };
      access_requests: {
        Row: AccessRequestRow;
        Insert: Insertable<
          AccessRequestRow,
          | 'id'
          | 'full_name'
          | 'provider'
          | 'user_id'
          | 'status'
          | 'created_at'
          | 'decided_at'
          | 'decided_by'
          | 'decided_note'
        >;
        Update: Partial<AccessRequestRow>;
        Relationships: [];
      };
      trustees: {
        Row: TrusteeRow;
        Insert: Insertable<TrusteeRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<TrusteeRow>;
        Relationships: [];
      };
      booking_requests: {
        Row: BookingRequestRow;
        Insert: Insertable<
          BookingRequestRow,
          | 'id'
          | 'public_token'
          | 'usage_type'
          | 'participants'
          | 'note'
          | 'status'
          | 'decided_by'
          | 'decided_at'
          | 'decision_note'
          | 'final_start'
          | 'final_end'
          | 'version'
          | 'submitted_ip_hash'
          | 'anonymised_at'
          | 'created_at'
        >;
        Update: Partial<BookingRequestRow>;
        Relationships: [];
      };
      events: {
        Row: EventRow;
        Insert: Insertable<
          EventRow,
          | 'id'
          | 'description'
          | 'requester_note'
          | 'show_note'
          | 'status'
          | 'source'
          | 'request_id'
          | 'recurring_id'
          | 'occurrence_date'
          | 'contact_name'
          | 'contact_phone'
          | 'show_contact'
          | 'created_by'
          | 'created_at'
          | 'updated_at'
        >;
        Update: Partial<EventRow>;
        Relationships: [];
      };
      recurring_rules: {
        Row: RecurringRuleRow;
        Insert: Insertable<
          RecurringRuleRow,
          'id' | 'valid_until' | 'is_active' | 'contact_name' | 'created_by' | 'created_at'
        >;
        Update: Partial<RecurringRuleRow>;
        Relationships: [];
      };
      closures: {
        Row: ClosureRow;
        Insert: Insertable<ClosureRow, 'id' | 'all_day' | 'created_by' | 'created_at'>;
        Update: Partial<ClosureRow>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: number;
          actor_id: string | null;
          actor_label: string | null;
          entity: string;
          entity_id: string | null;
          action: string;
          before: unknown;
          after: unknown;
          created_at: string;
        };
        Insert: {
          actor_id?: string | null;
          actor_label?: string | null;
          entity: string;
          entity_id?: string | null;
          action: string;
          before?: unknown;
          after?: unknown;
          created_at?: string;
        };
        // Append-only: there are no updatable columns, and saying so here means
        // an attempted `.update()` is a compile error rather than a silent
        // rewrite of the record it exists to preserve.
        Update: Record<string, never>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
        }>;
        Relationships: [];
      };
      notification_log: {
        Row: {
          id: number;
          channel: string;
          target: string;
          subject: string | null;
          payload: unknown;
          status: string;
          error: string | null;
          created_at: string;
        };
        Insert: {
          channel: string;
          target: string;
          subject?: string | null;
          payload?: unknown;
          status: string;
          error?: string | null;
          created_at?: string;
        };
        // Append-only: there are no updatable columns, and saying so here means
        // an attempted `.update()` is a compile error rather than a silent
        // rewrite of the record it exists to preserve.
        Update: Record<string, never>;
        Relationships: [];
      };
      rate_limits: {
        Row: { key: string; count: number; window_start: string };
        Insert: { key: string; count?: number; window_start?: string };
        Update: Partial<{ count: number; window_start: string }>;
        Relationships: [];
      };
    };

    Views: Record<string, never>;

    /**
     * §6.3. The argument names match the `p_` prefixed parameters exactly; a
     * typo in an `.rpc()` call is a compile error rather than a 404 at runtime.
     */
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_super_admin: { Args: Record<string, never>; Returns: boolean };
      my_allowlist_id: { Args: Record<string, never>; Returns: string };
      set_manager_role: {
        Args: { p_allowlist_id: string; p_role: AdminRole | null; p_revoke?: boolean };
        Returns: ManagerRow;
      };
      add_manager: {
        Args: { p_email: string; p_full_name?: string | null; p_role?: AdminRole };
        Returns: ManagerRow;
      };
      decide_access_request: {
        Args: {
          p_request_id: string;
          p_approve: boolean;
          p_role?: AdminRole;
          p_note?: string | null;
        };
        Returns: AccessRequestRow;
      };
      approve_request: {
        Args: {
          p_request_id: string;
          p_version: number;
          p_start?: string | null;
          p_end?: string | null;
          p_note?: string | null;
          p_show_note?: boolean;
        };
        Returns: EventRow;
      };
      reject_request: {
        Args: { p_request_id: string; p_version: number; p_note?: string | null };
        Returns: BookingRequestRow;
      };
      cancel_request_admin: {
        Args: { p_request_id: string; p_version: number; p_note?: string | null };
        Returns: BookingRequestRow;
      };
      delete_request: { Args: { p_request_id: string; p_version: number }; Returns: void };
      expire_stale_requests: { Args: Record<string, never>; Returns: number };
      anonymise_old_requests: { Args: { p_months?: number }; Returns: number };
      materialize_recurring: { Args: { p_horizon_days?: number }; Returns: number };
      create_closure: {
        Args: {
          p_reason: string;
          p_starts_at: string;
          p_ends_at: string;
          p_all_day?: boolean;
          p_cancel_conflicts?: boolean;
        };
        Returns: { closure: ClosureRow; cancelled: number };
      };
      preview_closure_conflicts: {
        Args: { p_starts_at: string; p_ends_at: string };
        Returns: EventRow[];
      };
    };

    Enums: {
      usage_type: UsageType;
      request_status: RequestStatus;
      event_status: 'scheduled' | 'cancelled';
      event_source: 'manual' | 'request' | 'recurring';
      admin_role: AdminRole;
      access_request_status: AccessRequestStatus;
    };

    CompositeTypes: Record<string, never>;
  };
};

export type { OpeningHours };
