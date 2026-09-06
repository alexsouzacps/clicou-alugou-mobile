import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuth } from '@/hooks/useAuth';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { supabase } from '@/services/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, radius } from '@/constants/layout';
import { formatCPF, formatPhone } from '@/utils/format';
import { validateImageFile } from '@/utils/uploadValidator';
import { useOnboardingStore } from '@/store/onboardingStore';

export default function PerfilScreen() {
  const router = useRouter();
  const { user, profile, logout } = useAuth();

  const [pushEnabled, setPushEnabled] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  async function handlePickAvatar() {
    if (!user) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];

        const validation = validateImageFile({
          mimeType: file.mimeType,
          fileSize: file.fileSize,
        });

        if (!validation.valid) {
          Alert.alert('Arquivo Inválido', validation.errorMessage);
          return;
        }

        setUploadingAvatar(true);
        const fileExt = file.uri.split('.').pop() || 'jpg';
        const filePath = `${user.id}/avatar.${fileExt}`;

        // Upload para Supabase Storage bucket 'avatars'
        const response = await fetch(file.uri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, blob, { upsert: true });

        if (uploadError) {
          Alert.alert('Erro', 'Não foi possível fazer upload da foto.');
          setUploadingAvatar(false);
          return;
        }

        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

        if (data.publicUrl) {
          await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id);
          Alert.alert('Foto Atualizada', 'Sua foto de perfil foi atualizada com sucesso!');
        }
      }
    } catch (err) {
      Alert.alert('Erro', 'Falha ao selecionar imagem.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleLogout() {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Tem certeza que deseja sair da sua conta?');
      if (confirmed) {
        await logout();
        router.replace('/(auth)/login');
      }
      return;
    }

    Alert.alert('Sair da conta', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Meu Perfil" />
        <Card style={styles.guestCard}>
          <Text style={styles.guestTitle}>Faça login no Clicou Alugou</Text>
          <Text style={styles.guestSub}>Acesse seus dados e preferências de conta.</Text>
          <Button
            label="Entrar"
            onPress={() => router.push('/(auth)/login')}
            fullWidth
            style={{ marginTop: spacing.md }}
          />
        </Card>

        <TouchableOpacity
          style={styles.guestResetLink}
          onPress={() => {
            useOnboardingStore.getState().reset();
            router.replace('/(auth)/permissions');
          }}
        >
          <MaterialCommunityIcons name="restart" size={18} color={colors.gray} />
          <Text style={styles.guestResetLinkText}>Reiniciar onboarding (teste)</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const roleLabel = profile?.role === 'proprietario' ? 'Proprietário' : 'Locatário';

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Meu Perfil" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Card do Usuário / Avatar */}
        <View style={styles.profileHeaderCard}>
          <TouchableOpacity style={styles.avatarWrapper} onPress={handlePickAvatar} disabled={uploadingAvatar}>
            <Image
              source={
                profile?.avatar_url
                  ? { uri: profile.avatar_url }
                  : require('../../assets/images/icon.png')
              }
              style={styles.avatar}
              contentFit="cover"
            />
            <View style={styles.cameraBadge}>
              <MaterialCommunityIcons name="camera" size={16} color={colors.white} />
            </View>
          </TouchableOpacity>

          <Text style={styles.userName}>{profile?.full_name || 'Usuário'}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>

          <Badge
            label={roleLabel}
            variant={profile?.role === 'proprietario' ? 'owner' : 'tenant'}
            size="md"
            style={{ marginTop: spacing.xs }}
          />
        </View>

        {/* Seção: Dados Pessoais */}
        <Text style={styles.sectionHeader}>Dados Pessoais</Text>
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>CPF</Text>
            <Text style={styles.infoValue}>{formatCPF(profile?.cpf_cnpj)}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Telefone</Text>
            <Text style={styles.infoValue}>{formatPhone(profile?.phone)}</Text>
          </View>
        </Card>

        {/* Seção: Preferências e Segurança */}
        <Text style={styles.sectionHeader}>Segurança & Preferências</Text>
        <Card style={styles.infoCard}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <MaterialCommunityIcons name="bell-outline" size={22} color={colors.navy} />
              <Text style={styles.switchLabel}>Notificações Push</Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={setPushEnabled}
              trackColor={{ false: colors.border.default, true: colors.cyan }}
              thumbColor={colors.white}
            />
          </View>
        </Card>

        {/* Suporte & Sobre */}
        <Text style={styles.sectionHeader}>Sobre o App</Text>
        <Card style={styles.infoCard}>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => {
              useOnboardingStore.getState().setHasSeenTour(false);
              router.push('/(tabs)');
            }}
          >
            <Text style={styles.linkLabel}>Ver tour novamente</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.gray} />
          </TouchableOpacity>
          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.linkRow}
            onPress={async () => {
              if (user) {
                await logout();
              }
              useOnboardingStore.getState().reset();
              router.replace('/(auth)/permissions');
            }}
          >
            <Text style={styles.linkLabel}>Reiniciar onboarding (teste)</Text>
            <MaterialCommunityIcons name="restart" size={20} color={colors.gray} />
          </TouchableOpacity>
          <View style={styles.divider} />

          <TouchableOpacity style={styles.linkRow}>
            <Text style={styles.linkLabel}>Termos de Uso</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.gray} />
          </TouchableOpacity>
          <View style={styles.divider} />

          <TouchableOpacity style={styles.linkRow}>
            <Text style={styles.linkLabel}>Política de Privacidade</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.gray} />
          </TouchableOpacity>
          <View style={styles.divider} />

          <View style={styles.linkRow}>
            <Text style={styles.linkLabel}>Versão do App</Text>
            <Text style={styles.versionText}>1.0.0 (MVP)</Text>
          </View>
        </Card>

        {/* Sair da Conta */}
        <Button
          label="Sair da Conta"
          onPress={handleLogout}
          variant="danger"
          icon="logout"
          fullWidth
          style={styles.logoutButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.default,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  profileHeaderCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.bg.input,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.cyan,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  userName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.navy,
  },
  userEmail: {
    fontSize: typography.sizes.sm,
    color: colors.gray,
    marginBottom: spacing.xs,
  },
  sectionHeader: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.navy,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
  },
  infoCard: {
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  infoLabel: {
    fontSize: typography.sizes.sm,
    color: colors.gray,
  },
  infoValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.black,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  switchLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  switchLabel: {
    fontSize: typography.sizes.sm,
    color: colors.navy,
    fontWeight: typography.weights.medium,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  linkLabel: {
    fontSize: typography.sizes.sm,
    color: colors.black,
  },
  versionText: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
  },
  logoutButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  guestCard: {
    margin: spacing.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  guestTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.navy,
  },
  guestSub: {
    fontSize: typography.sizes.sm,
    color: colors.gray,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  guestResetLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  guestResetLinkText: {
    fontSize: typography.sizes.sm,
    color: colors.gray,
  },
});
