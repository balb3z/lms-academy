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
    console.log('🔐 useAuth: Setting up auth listener...');
    
    let subscription: any = null;

    const setupAuthListener = async () => {
      try {
        // Get current session first
        const { data: sessionData } = await auth.getCurrentSession();
        if (sessionData?.session?.user) {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', sessionData.session.user.id)
            .single();
          if (userData) {
            setUser(userData);
            setRole(userData.role);
          }
        }
        setLoading(false);

        // Set up auth listener
        const { data: authData } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('🔐 Auth event:', event);
          
          if (session?.user) {
            console.log('🔐 User authenticated:', session.user.email);
            try {
              const { data: userData, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();
              
              if (error) {
                console.error('❌ Error fetching user data:', error);
              } else {
                console.log('✅ User data loaded:', userData);
                setUser(userData);
                setRole(userData?.role);
              }
            } catch (error) {
              console.error('❌ Error in auth state change:', error);
            }
          } else {
            console.log('🔐 User logged out');
            setUser(null);
            setRole(null);
          }
          setLoading(false);
        });

        subscription = authData;
      } catch (error) {
        console.error('❌ Error setting up auth:', error);
        setLoading(false);
      }
    };

    setupAuthListener();

    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔐 Signing in:', email);
      const { user, role } = await auth.signIn(email, password);
      console.log('✅ Sign in successful:', email, 'Role:', role);
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
        default:
          navigate('/');
      }
      toast.success('Welcome back!');
    } catch (error: any) {
      console.error('❌ Sign in error:', error);
      toast.error(error.message || 'Login failed');
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await auth.signOut();
      setUser(null);
      setRole(null);
      navigate('/auth/login');
      toast.info('Logged out successfully');
    } catch (error: any) {
      console.error('❌ Sign out error:', error);
      toast.error(error.message || 'Logout failed');
    }
  };

  console.log('🔐 useAuth state:', { user: user?.email, role, loading });

  return { user, role, loading, signIn, signOut };
}