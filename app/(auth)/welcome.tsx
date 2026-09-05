import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { safeImpactAsync } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';
import { useOnboardingStore } from '@/store/onboardingStore';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, radius } from '@/constants/layout';
import { ProfileRole } from '@/types/database';

export default function WelcomeScreen() {
  const router = useRouter();
  const setRole = useOnboardingStore((s) => s.setRole);
  const setIsGuest = useOnboardingStore((s) => s.setIsGuest);

  const handleEntrar = () => {
    safeImpactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(auth)/login');
  };

  const handleSelectRole = (role: ProfileRole) => {
    safeImpactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRole(role);
    router.push(`/(auth)/cadastro?role=${role}`);
  };

  const handleGuest = () => {
    safeImpactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsGuest(true);
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <SafeAreaView style={styles.contentContainer}>
        {/* Marca Clicou Alugou no topo */}
        <View style={styles.topBrand}>
          <Image
            source={require('../../assets/images/720-1.png')}
            style={styles.topBrandLogo}
            contentFit="contain"
          />
        </View>

        {/* Bloco Central: Frase + seleção de papel + acesso */}
        <View style={styles.centerBlock}>
          <View style={styles.headlineWrapper}>
            <Text style={styles.headlineText}>
              Seu novo endereço{'\n'}sem burocracia
            </Text>
          </View>

          <View style={styles.roleSelector}>
            <TouchableOpacity
              style={styles.roleCard}
              onPress={() => handleSelectRole('locatario')}
              activeOpacity={0.85}
            >
              <View style={styles.roleCardIcon}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.white} />
              </View>
              <Text style={styles.roleCardText}>Quero alugar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.roleCard}
              onPress={() => handleSelectRole('proprietario')}
              activeOpacity={0.85}
            >
              <View style={styles.roleCardIcon}>
                <MaterialCommunityIcons name="home-city" size={20} color={colors.white} />
              </View>
              <Text style={styles.roleCardText}>Sou proprietário</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>já tem conta?</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.pillButton}
            onPress={handleEntrar}
            activeOpacity={0.85}
          >
            <Text style={styles.pillButtonText}>ENTRAR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryLink}
            onPress={handleGuest}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryLinkText}>Continuar sem conta</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#012247', // Trust Navy
    position: 'relative',
    overflow: 'hidden',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    paddingTop: Platform.OS === 'web' ? spacing.lg : spacing.sm,
    paddingBottom: spacing.xl,
  },
  topBrand: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  topBrandLogo: {
    width: 220,
    height: 55,
  },
  centerBlock: {
    alignItems: 'center',
  },
  headlineWrapper: {
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headlineText: {
    fontFamily: typography.fonts.medium,
    fontSize: 32,
    lineHeight: 40,
    color: '#FFFFFF',
    textAlign: 'left',
  },
  roleSelector: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
    marginHorizontal: spacing.sm,
    alignSelf: 'stretch',
  },
  roleCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  roleCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  roleCardText: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.sm,
    color: colors.white,
    textAlign: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  dividerText: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.xs,
    color: 'rgba(255,255,255,0.55)',
  },
  pillButton: {
    backgroundColor: '#FF4B26', // Momentum Orange
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    minWidth: 170,
  },
  pillButtonText: {
    fontFamily: typography.fonts.bold,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  secondaryLink: {
    marginTop: 16,
    paddingVertical: 6,
  },
  secondaryLinkText: {
    fontFamily: typography.fonts.medium,
    fontSize: 13,
    color: '#FFFFFF',
    opacity: 0.85,
  },
});
