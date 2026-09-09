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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('✅ Supabase client initialized successfully');