import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseAdminConfigured = Boolean(supabaseUrl && serviceRoleKey);

/**
 * Server-only Supabase Admin client with service_role privileges.
 * NEVER expose this or import in client components.
 */
export const supabaseAdmin = isSupabaseAdminConfigured
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;
