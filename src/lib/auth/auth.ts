import { supabase } from '../supabase/client';
import { UserRole } from '@/types';

export const auth = {
  async signIn(email: string, password: string) {
    console.log('🔐 auth.signIn called for:', email);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      console.error('❌ Sign in error:', error);
      throw error;
    }
    
    console.log('✅ Sign in successful, fetching user role...');
    
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
    
    console.log('✅ User role fetched:', userData.role);
    
    return {
      user: data.user,
      role: userData.role as UserRole
    };
  },

  async signOut() {
    console.log('🔐 Signing out...');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('❌ Sign out error:', error);
      throw error;
    }
    console.log('✅ Signed out successfully');
  },

  async resetPassword(email: string) {
    console.log('🔐 Resetting password for:', email);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) {
      console.error('❌ Reset password error:', error);
      throw error;
    }
    console.log('✅ Password reset email sent');
  },

  async updatePassword(newPassword: string) {
    console.log('🔐 Updating password...');
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (error) {
      console.error('❌ Update password error:', error);
      throw error;
    }
    console.log('✅ Password updated successfully');
  },

  getCurrentUser() {
    return supabase.auth.getUser();
  },

  getCurrentSession() {
    return supabase.auth.getSession();
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    console.log('🔐 Setting up auth state change listener...');
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth event:', event);
      callback(event, session);
    });
    // Return the subscription object
    return data;
  }
};