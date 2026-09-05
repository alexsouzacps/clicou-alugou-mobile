import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProfileRole } from '@/types/database';

interface OnboardingState {
  hasSeenPermissions: boolean;
  role: ProfileRole | null;
  isGuest: boolean;
  hasSeenTour: boolean;
  /** true assim que o AsyncStorage terminou de reidratar a store */
  hasHydrated: boolean;

  setHasSeenPermissions: (value: boolean) => void;
  setRole: (role: ProfileRole | null) => void;
  setIsGuest: (value: boolean) => void;
  setHasSeenTour: (value: boolean) => void;
  setHasHydrated: (value: boolean) => void;
  reset: () => void;
}

const initialState = {
  hasSeenPermissions: false,
  role: null as ProfileRole | null,
  isGuest: false,
  hasSeenTour: false,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialState,
      hasHydrated: false,

      setHasSeenPermissions: (hasSeenPermissions) => set({ hasSeenPermissions }),
      setRole: (role) => set({ role }),
      setIsGuest: (isGuest) => set({ isGuest }),
      setHasSeenTour: (hasSeenTour) => set({ hasSeenTour }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      reset: () => set({ ...initialState, hasHydrated: true }),
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        hasSeenPermissions: state.hasSeenPermissions,
        role: state.role,
        isGuest: state.isGuest,
        hasSeenTour: state.hasSeenTour,
      }),
      // Roda tanto em sucesso quanto em falha de leitura do AsyncStorage,
      // para nunca travar o guard de navegação esperando hidratação que não vem.
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          useOnboardingStore.setState({ hasHydrated: true });
        } else {
          state?.setHasHydrated(true);
        }
      },
    }
  )
);
