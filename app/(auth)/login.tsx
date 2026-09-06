import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '@/services/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, radius } from '@/constants/layout';
import { handleSupabaseError } from '@/utils/errorHandler';
import { isValidEmail } from '@/utils/validation';
import { useOnboardingStore } from '@/store/onboardingStore';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleEmailLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Atenção', 'Por favor, preencha todos os campos.');
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert('Atenção', 'Por favor, insira um e-mail válido.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        Alert.alert('Erro ao entrar', handleSupabaseError(error));
      } else {
        useOnboardingStore.getState().setIsGuest(false);
        router.replace('/(tabs)');
      }
    } catch (err) {
      Alert.alert('Erro', 'Ocorreu uma falha na autenticação.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    try {
      if (Platform.OS === 'web') {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081';
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${origin}/(auth)/callback`,
          },
        });
        if (error) {
          Alert.alert('Erro no Google Login', handleSupabaseError(error));
        }
        return;
      }

      // Native Mobile (Android / iOS)
      const redirectUrl = AuthSession.makeRedirectUri({ scheme: 'clicoualugou' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        Alert.alert('Erro no Google Login', handleSupabaseError(error));
        return;
      }

      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (result.type === 'success' && result.url) {
          const urlObj = new URL(result.url);
          const hashParams = new URLSearchParams(urlObj.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (!sessionError) {
              useOnboardingStore.getState().setIsGuest(false);
              router.replace('/(tabs)');
            }
          }
        }
      }
    } catch (err) {
      Alert.alert('Erro', 'Falha ao conectar com o Google.');
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header Branding */}
        <View style={styles.brandContainer}>
          <Image
            source={require('../../assets/images/400-2.png')}
            style={styles.brandLogo}
            contentFit="contain"
          />
          <Text style={styles.brandSubtitle}>Aluguel digital simples, rápido e transparente.</Text>
        </View>

        {/* Card de Formulário */}
        <View style={styles.formCard}>
          <Text style={styles.welcomeText}>Bem-vindo de volta! 👋</Text>

          {/* Login Social (Google) */}
          <Button
            label="Continuar com Google"
            onPress={handleGoogleLogin}
            variant="secondary"
            loading={googleLoading}
            icon="google"
            fullWidth
            style={styles.socialButton}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou entre com e-mail</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Form E-mail / Senha */}
          <Input
            label="E-mail"
            placeholder="seu.email@exemplo.com"
            value={email}
            onChangeText={setEmail}
            type="email"
            leftIcon="email-outline"
          />

          <Input
            label="Senha"
            placeholder="Sua senha secreta"
            value={password}
            onChangeText={setPassword}
            type="password"
            leftIcon="lock-outline"
          />

          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotText}>Esqueceu sua senha?</Text>
          </TouchableOpacity>

          <Button
            label="Entrar"
            onPress={handleEmailLogin}
            loading={loading}
            fullWidth
            style={styles.submitButton}
          />
        </View>

        {/* Footer Cadastre-se */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Ainda não tem uma conta?</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/cadastro')}>
            <Text style={styles.registerLink}>Cadastre-se gratuitamente</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg.default,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.xl,
    justifyContent: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  brandLogo: {
    width: 220,
    height: 64,
    marginBottom: spacing.xs,
  },
  brandSubtitle: {
    fontFamily: typography.fonts.medium,
    fontSize: typography.sizes.sm,
    color: colors.gray,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  welcomeText: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.black,
    marginBottom: spacing.lg,
  },
  socialButton: {
    marginBottom: spacing.lg,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.default,
  },
  dividerText: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
    paddingHorizontal: spacing.md,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
    marginTop: -spacing.xs,
  },
  forgotText: {
    fontSize: typography.sizes.sm,
    color: colors.cyan,
    fontWeight: typography.weights.medium,
  },
  submitButton: {
    marginTop: spacing.xs,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    fontSize: typography.sizes.sm,
    color: colors.gray,
  },
  registerLink: {
    fontSize: typography.sizes.sm,
    color: colors.cyan,
    fontWeight: typography.weights.bold,
    marginTop: spacing.xs,
  },
});
