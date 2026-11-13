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
    let cancelled = false;

    const loadUserRow = async (userId: string) => {
      try {
        const { data: userData, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.error('Error fetching user data:', error);
        } else if (userData) {
          setUser(userData);
          setRole(userData.role);
        } else {
          console.warn('No user row found in public.users for:', userId);
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
      }
    };

    // Register synchronously so cleanup can always unsubscribe.
    const { data: authData } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const userId = session.user.id;
        // Defer: awaiting Supabase queries inside this callback can deadlock supabase-js v2.
        setTimeout(async () => {
          await loadUserRow(userId);
          if (!cancelled) setLoading(false);
        }, 0);
      } else {
        setUser(null);
        setRole(null);
        setLoading(false);
      }
    });

    (async () => {
      try {
        const { data: sessionData } = await auth.getCurrentSession();
        if (cancelled) return;
        if (sessionData?.session?.user) {
          await loadUserRow(sessionData.session.user.id);
        }
      } catch (error) {
        console.error('Error setting up auth:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      authData.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
try {
              const { user, role } = await auth.signIn(email, password);
              setUser({
                id: user.id,
                email: user.email ?? email,
                role,
                created_at: user.created_at,
                updated_at: user.updated_at ?? user.created_at,
              });
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
            } catch (error) {
              console.error('❌ Sign in error:', error);
              toast.error(error instanceof Error ? error.message : 'Login failed');
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
    } catch (error) {
      console.error('❌ Sign out error:', error);
      toast.error(error instanceof Error ? error.message : 'Logout failed');
    }
  };


  return { user, role, loading, signIn, signOut };
}