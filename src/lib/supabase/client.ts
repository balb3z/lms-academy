import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔌 Initializing Supabase client...');
console.log('🔌 Supabase URL:', supabaseUrl ? '✅ Set' : '❌ Not Set');
console.log('🔌 Supabase Key:', supabaseAnonKey ? '✅ Set' : '❌ Not Set');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!');
  throw new Error('Missing Supabase environment variables');
}

/**
 * Main application client.
 * Persists the signed-in session in localStorage (default behaviour).
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'lms-academy-auth'
  }
});

/**
 * Isolated client used ONLY to provision new accounts from the management
 * dashboard.
 *
 * Why a second client?
 * `supabase.auth.signUp()` immediately swaps the active session to the newly
 * created user. If we called it on the main client, the logged-in management
 * user would be silently kicked out of their own session.
 *
 * This client is configured with `persistSession: false`, so it never writes to
 * localStorage and never fires auth events on the main client. The new user's
 * session lives in memory only and is discarded right after the account row is
 * created, which leaves the management session completely untouched.
 *
 * NOTE: this uses the public anon key only. The service_role key must NEVER be
 * added to a Vite frontend, because every `VITE_*` variable is inlined into the
 * JavaScript bundle and would be readable by any visitor.
 */
export const provisioningClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'lms-academy-provisioning'
  }
});

console.log('✅ Supabase client initialized successfully');
