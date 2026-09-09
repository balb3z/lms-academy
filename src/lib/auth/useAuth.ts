import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { auth } from './auth';
import { supabase } from '../supabase/client';
import { User, UserRole } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: subscription } = auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        setUser(userData);
        setRole(userData?.role);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { user, role } = await auth.signIn(email, password);
      setUser(user);
      setRole(role);
      
      switch(role) {
        case 'management':
          navigate('/management');
          break;
        case 'teacher':
          navigate('/teacher');
          break;
        case 'student':
          navigate('/student');
          break;
      }
      toast.success('Welcome back!');
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
      throw error;
    }
  };

  const signOut = async () => {
    await auth.signOut();
    setUser(null);
    setRole(null);
    navigate('/auth/login');
    toast.info('Logged out successfully');
  };

  return { user, role, loading, signIn, signOut };
}