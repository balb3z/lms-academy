import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

export function useSupabase() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async <T>(query: Promise<{ data: T | null; error: any }>) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, execute, supabase };
}