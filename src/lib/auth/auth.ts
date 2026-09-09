import { supabase } from '../supabase/client';
import { UserRole } from '@/types';

export const auth = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single();
      
    if (userError) throw userError;
    
    return {
      user: data.user,
      role: userData.role as UserRole
    };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) throw error;
  },

  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
  },

  getCurrentUser() {
    return supabase.auth.getUser();
  },

  getCurrentSession() {
    return supabase.auth.getSession();
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
};