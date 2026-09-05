import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useOnboardingStore } from '@/store/onboardingStore';
import { resolveOnboardingRoute } from '@/utils/resolveOnboardingRoute';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutos
    },
  },
});

function RootNavigation() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isGuest, hasSeenPermissions, hasSeenTour, hasHydrated } = useOnboardingStore();
  const segments = useSegments();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    'Gantari-Regular': require('../assets/fonts/ttf/Gantari-Regular.ttf'),
    'Gantari-Medium': require('../assets/fonts/ttf/Gantari-Medium.ttf'),
    'Gantari-SemiBold': require('../assets/fonts/ttf/Gantari-SemiBold.ttf'),
    'Gantari-Bold': require('../assets/fonts/ttf/Gantari-Bold.ttf'),
    'Gantari-ExtraBold': require('../assets/fonts/ttf/Gantari-ExtraBold.ttf'),
  });

  const isLoading = authLoading || !fontsLoaded || !hasHydrated;

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  useEffect(() => {
    if (isLoading) return;

    const nextRoute = resolveOnboardingRoute({
      isAuthenticated,
      isGuest,
      hasSeenPermissions,
      hasSeenTour,
      segment: segments[0],
    });

    if (nextRoute) {
      router.replace(nextRoute as never);
    }
  }, [isAuthenticated, isGuest, hasSeenPermissions, hasSeenTour, isLoading, segments]);

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Carregando Clicou Alugou..." />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="imovel/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="proposta/[propertyId]" options={{ headerShown: false }} />
      <Stack.Screen name="contrato/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="reserva/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="manutencao/index" options={{ headerShown: false }} />
      <Stack.Screen name="manutencao/nova" options={{ headerShown: false }} />
      <Stack.Screen name="manutencao/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="chat/[roomId]" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <RootNavigation />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
