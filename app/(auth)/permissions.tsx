import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Notifications from 'expo-notifications';
import { safeImpactAsync } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';
import { useOnboardingStore } from '@/store/onboardingStore';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, radius, shadow } from '@/constants/layout';

export default function PermissionsScreen() {
  const router = useRouter();
  const setHasSeenPermissions = useOnboardingStore((s) => s.setHasSeenPermissions);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    safeImpactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      // Notificação é o único pedido de permissão feito "a frio" aqui — é central
      // ao valor do app (avisos de proposta/mensagem). Localização fica para quando
      // o usuário realmente usar a busca por proximidade (permission priming just-in-time).
      if (Platform.OS !== 'web') {
        await Notifications.requestPermissionsAsync();
      }
    } catch (e) {
      console.log('Permissão de notificação:', e);
    } finally {
      setHasSeenPermissions(true);
      setLoading(false);
      router.replace('/(auth)/welcome');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require('../../assets/images/400-2.png')}
          style={styles.brandLogo}
          contentFit="contain"
        />

        <View style={styles.headingBlock}>
          <Text style={styles.title}>Fique por dentro de tudo</Text>
          <Text style={styles.subtitle}>
            Precisamos de algumas permissões para deixar sua experiência mais completa.
          </Text>
        </View>

        <View style={styles.reasonCard}>
          <View style={[styles.iconChip, { backgroundColor: 'rgba(15, 90, 222, 0.1)' }]}>
            <MaterialCommunityIcons name="bell-outline" size={22} color={colors.blue} />
          </View>
          <View style={styles.reasonTextCol}>
            <Text style={styles.reasonTitle}>Notificações</Text>
            <Text style={styles.reasonSub}>
              Avisos de novas propostas, mensagens e atualizações de contrato.
            </Text>
          </View>
        </View>

        <View style={styles.reasonCard}>
          <View style={[styles.iconChip, { backgroundColor: 'rgba(255, 75, 38, 0.1)' }]}>
            <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.orange} />
          </View>
          <View style={styles.reasonTextCol}>
            <Text style={styles.reasonTitle}>Localização</Text>
            <Text style={styles.reasonSub}>
              Perguntamos apenas quando você usar a busca por imóveis próximos.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.consentNote}>
          Ao continuar, você concorda com os nossos Termos de Uso e Política de Privacidade.
        </Text>

        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.continueButtonText}>{loading ? 'Aguarde...' : 'Continuar'}</Text>
        </TouchableOpacity>

        <Text style={styles.reassuranceNote}>
          Você pode alterar essas permissões depois nas configurações do app.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.default,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  brandLogo: {
    width: 172,
    height: 48,
    alignSelf: 'center',
    marginBottom: spacing['2xl'],
  },
  headingBlock: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: typography.fonts.bold,
    fontSize: 26,
    color: colors.navy,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.sm,
    color: colors.gray,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.white,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonTextCol: {
    flex: 1,
  },
  reasonTitle: {
    fontFamily: typography.fonts.bold,
    fontSize: typography.sizes.base,
    color: colors.navy,
  },
  reasonSub: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.xs,
    color: colors.gray,
    marginTop: 2,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  consentNote: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.xs,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: spacing.md,
  },
  continueButton: {
    backgroundColor: colors.blue,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    alignItems: 'center',
    ...shadow.md,
  },
  continueButtonText: {
    fontFamily: typography.fonts.bold,
    fontSize: typography.sizes.base,
    color: colors.white,
  },
  reassuranceNote: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.xs - 1,
    color: colors.gray,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
