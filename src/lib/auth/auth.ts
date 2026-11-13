import { supabase } from '../supabase/client';
import type { Session } from '@supabase/supabase-js';
import { UserRole } from '@/types';

export const auth = {
  async signIn(email: string, password: string) {
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      console.error('❌ Sign in error:', error);
      throw error;
    }
    
    
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();
      
    if (userError) {
      console.error('❌ Error fetching user role:', userError);
      throw userError;
    }
    
    if (!userData) {
      console.error('❌ No user row found in public.users for:', data.user.id);
      throw new Error('User account not properly configured. Please contact management.');
    }
    
    
    return {
      user: data.user,
      role: userData.role as UserRole
    };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('❌ Sign out error:', error);
      throw error;
    }
  },

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) {
      console.error('❌ Reset password error:', error);
      throw error;
    }
  },

  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (error) {
      console.error('❌ Update password error:', error);
      throw error;
    }
  },

  getCurrentUser() {
    return supabase.auth.getUser();
  },

  getCurrentSession() {
    return supabase.auth.getSession();
  },

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
    // Return the subscription object
    return data;
  }
};