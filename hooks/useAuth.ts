import { useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { ProfileRow } from '@/types/database';

export function useAuth() {
  const { user, profile, isLoading, isAuthenticated, setUser, setProfile, setIsLoading, logout } =
    useAuthStore();

  useEffect(() => {
    // Busca inicial de sessão
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Listener de mudanças na sessão (login, logout, refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data as ProfileRow);
      }
    } catch (err) {
      console.warn('[useAuth] Erro ao carregar perfil:', err);
    } finally {
      setIsLoading(false);
    }
  }

  return {
    user,
    profile,
    isLoading,
    isAuthenticated,
    logout,
  };
}
