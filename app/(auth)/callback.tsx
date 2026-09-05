import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/services/supabase';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { colors } from '@/constants/colors';
import { useOnboardingStore } from '@/store/onboardingStore';

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const url = Linking.useURL();

  useEffect(() => {
    handleCallback();
  }, [url]);

  async function handleCallback() {
    try {
      // 1. Verifica se o cliente do Supabase já processou a sessão automaticamente na web
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        useOnboardingStore.getState().setIsGuest(false);
        router.replace('/(tabs)');
        return;
      }

      const currentUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
      if (!currentUrl) return;

      const parsedUrl = new URL(currentUrl);
      const hashParams = new URLSearchParams(parsedUrl.hash.substring(1));
      const searchParams = new URLSearchParams(parsedUrl.search);

      const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');

      if (accessToken && refreshToken) {
        const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

        if (userError || !user) {
          router.replace('/(auth)/login');
          return;
        }

        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!error) {
          useOnboardingStore.getState().setIsGuest(false);
          router.replace('/(tabs)');
          return;
        }
      }

      router.replace('/(auth)/login');
    } catch (err) {
      console.warn('[OAuthCallback] Erro no callback:', err);
      router.replace('/(auth)/login');
    }
  }

  return (
    <View style={styles.container}>
      <LoadingSpinner message="Autenticando..." />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
