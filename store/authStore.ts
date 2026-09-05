import { create } from 'zustand';
import { User } from '@supabase/supabase-js';
import { ProfileRow } from '@/types/database';
import { supabase } from '@/services/supabase';

interface AuthState {
  user: User | null;
  profile: ProfileRow | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: ProfileRow | null) => void;
  setIsLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
    }),

  setProfile: (profile) => set({ profile }),

  setIsLoading: (isLoading) => set({ isLoading }),

  logout: async () => {
    set({ isLoading: true });
    await supabase.auth.signOut();
    set({
      user: null,
      profile: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },
}));
