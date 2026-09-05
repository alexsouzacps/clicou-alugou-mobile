import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { supabase } from '@/services/supabase';
import { showAlert } from '@/utils/crossAlert';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, radius } from '@/constants/layout';
import { formatPrice } from '@/utils/format';

interface MenuRowProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  sublabel?: string;
  accentColor: string;
  badge?: number;
  comingSoon?: boolean;
  onPress: () => void;
}

function MenuRow({ icon, label, sublabel, accentColor, badge, comingSoon, onPress }: MenuRowProps) {
  return (
    <TouchableOpacity
      style={styles.menuRow}
      activeOpacity={0.7}
      onPress={
        comingSoon
          ? () => showAlert('Em breve', 'Essa funcionalidade ainda está a caminho no app.')
          : onPress
      }
    >
      <View style={[styles.menuRowIcon, { backgroundColor: `${accentColor}1A` }]}>
        <MaterialCommunityIcons name={icon} size={20} color={accentColor} />
      </View>
      <View style={styles.menuRowTextCol}>
        <Text style={styles.menuRowLabel}>{label}</Text>
        {sublabel && <Text style={styles.menuRowSublabel}>{sublabel}</Text>}
      </View>
      {comingSoon ? (
        <Text style={styles.comingSoonTag}>Em breve</Text>
      ) : !!badge && badge > 0 ? (
        <View style={styles.menuRowBadge}>
          <Text style={styles.menuRowBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.gray} />
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const theme = useRoleTheme(profile?.role);

  const isOwner = profile?.role === 'proprietario';

  // Contratos Ativos do Locatário
  const {
    data: tenantContracts = [],
    isLoading: loadingTenantContracts,
    refetch: refetchTenant,
  } = useQuery({
    queryKey: ['tenantContracts', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('contracts')
        .select('*, property:properties(title, address_street, address_number, address_neighborhood, address_city)')
        .eq('tenant_id', user!.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user && !isOwner,
  });

  // Propostas Recebidas pelo Proprietário
  const {
    data: ownerProposals = [],
    isLoading: loadingOwnerProposals,
    refetch: refetchOwner,
  } = useQuery({
    queryKey: ['ownerProposals', user?.id],
    queryFn: async () => {
      // Busca imóveis do proprietário
      const { data: props } = await supabase
        .from('properties')
        .select('id')
        .eq('owner_id', user!.id);

      const propIds = (props || []).map((p) => p.id);
      if (propIds.length === 0) return [];

      const { data } = await supabase
        .from('rental_interests')
        .select('*, tenant:profiles!rental_interests_tenant_id_fkey(full_name, phone), property:properties(title, rent_amount)')
        .in('property_id', propIds)
        .eq('status', 'pendente')
        .order('created_at', { ascending: false });

      return data || [];
    },
    enabled: !!user && isOwner,
  });

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Minha Área" />
        <EmptyState
          icon="account-lock-outline"
          title="Acesse sua conta"
          subtitle="Entre com seu e-mail e senha para visualizar seus contratos, pagamentos, propostas e chamados de manutenção."
          action={{
            label: 'Fazer Login',
            onPress: () => router.push('/(auth)/login'),
          }}
        />
      </SafeAreaView>
    );
  }

  const handleRefresh = () => {
    if (isOwner) refetchOwner();
    else refetchTenant();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Minha Área"
        role={profile?.role === 'proprietario' ? 'owner' : 'tenant'}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={theme.accentColor} />}
      >
        {/* User Role Badge Card */}
        <View style={[styles.roleHeaderCard, { backgroundColor: theme.cardBg }]}>
          <View style={styles.roleHeaderRow}>
            <View>
              <Text style={styles.userNameText}>{profile?.full_name || 'Usuário'}</Text>
              <Text style={styles.userEmailText}>{user.email}</Text>
            </View>
            <Badge label={theme.roleLabel} variant={theme.badgeVariant} size="md" />
          </View>
        </View>

        {/* ── VISÃO DO LOCATÁRIO ── */}
        {!isOwner && (
          <>
            <Text style={styles.sectionTitle}>Contrato Ativo</Text>
            {tenantContracts.length > 0 ? (
              tenantContracts.map((contract: any) => (
                <Card
                  key={contract.id}
                  onPress={() => router.push(`/contrato/${contract.id}`)}
                  style={styles.contractCard}
                >
                  <View style={styles.contractHeader}>
                    <Text style={styles.contractTitle} numberOfLines={1}>
                      {contract.property?.title || 'Imóvel em Locação'}
                    </Text>
                    <Badge label={contract.status.toUpperCase()} variant="success" size="sm" />
                  </View>

                  <Text style={styles.contractAddress} numberOfLines={1}>
                    {contract.property?.address_street}, {contract.property?.address_number} —{' '}
                    {contract.property?.address_neighborhood}
                  </Text>

                  <View style={styles.contractDivider} />

                  <View style={styles.contractFooterRow}>
                    <View>
                      <Text style={styles.miniLabel}>Aluguel mensal</Text>
                      <Text style={styles.contractPrice}>{formatPrice(contract.rent_amount)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.miniLabel}>Vencimento</Text>
                      <Text style={styles.dueDateText}>Todo dia {contract.due_day}</Text>
                    </View>
                  </View>
                </Card>
              ))
            ) : (
              <Card style={styles.emptyCard}>
                <MaterialCommunityIcons name="file-document-outline" size={32} color={colors.gray} />
                <Text style={styles.emptyCardText}>Nenhum contrato ativo no momento.</Text>
              </Card>
            )}

          </>
        )}

        {/* ── VISÃO DO PROPRIETÁRIO ── */}
        {isOwner && (
          <>
            {/* Alertas */}
            <Text style={styles.sectionTitle}>Alertas & Pendências</Text>
            {ownerProposals.length > 0 ? (
              <Card
                onPress={() => router.push('/proposta/recebidas')}
                style={styles.alertCard}
              >
                <View style={styles.alertHeader}>
                  <View style={styles.alertBadgeCircle}>
                    <MaterialCommunityIcons name="bell-ring-outline" size={20} color={colors.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertTitle}>
                      {ownerProposals.length} proposta(s) aguardando sua resposta!
                    </Text>
                    <Text style={styles.alertSub}>Toque para visualizar e responder</Text>
                  </View>
                </View>
              </Card>
            ) : (
              <Card style={styles.emptyCard}>
                <MaterialCommunityIcons name="check-circle-outline" size={32} color={colors.success} />
                <Text style={styles.emptyCardText}>Nenhuma proposta pendente de aprovação.</Text>
              </Card>
            )}

          </>
        )}

        {/* ── MENU: COMO LOCATÁRIO ── */}
        <View style={styles.menuSectionHeader}>
          <View style={[styles.menuSectionIcon, { backgroundColor: colors.cyan }]}>
            <MaterialCommunityIcons name="key-outline" size={14} color={colors.white} />
          </View>
          <Text style={styles.menuSectionTitle}>Como locatário</Text>
        </View>
        <View style={styles.menuCard}>
          <MenuRow
            icon="heart-outline"
            label="Favoritos e listas"
            accentColor={colors.cyan}
            onPress={() => router.push('/favoritos')}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="send-outline"
            label="Propostas enviadas"
            accentColor={colors.cyan}
            onPress={() => router.push('/proposta/enviadas')}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="bag-suitcase-outline"
            label="Reservas de temporada"
            accentColor={colors.cyan}
            onPress={() => router.push('/reserva/index')}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="file-document-outline"
            label="Contratos e pagamentos"
            accentColor={colors.cyan}
            onPress={() => router.push('/contrato/index')}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="wrench-outline"
            label="Manutenção"
            accentColor={colors.cyan}
            onPress={() => router.push({ pathname: '/manutencao', params: { tab: 'locatario' } })}
          />
        </View>

        {/* ── MENU: COMO PROPRIETÁRIO ── */}
        <View style={styles.menuSectionHeader}>
          <View style={[styles.menuSectionIcon, { backgroundColor: colors.success }]}>
            <MaterialCommunityIcons name="home-city-outline" size={14} color={colors.white} />
          </View>
          <Text style={styles.menuSectionTitle}>Como proprietário</Text>
        </View>
        <View style={styles.menuCard}>
          <MenuRow
            icon="home-plus-outline"
            label="Anunciar imóvel"
            accentColor={colors.success}
            comingSoon
            onPress={() => {}}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="home-city-outline"
            label="Meus imóveis"
            accentColor={colors.success}
            comingSoon
            onPress={() => {}}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="clipboard-text-outline"
            label="Propostas recebidas"
            accentColor={colors.success}
            badge={ownerProposals.length}
            onPress={() => router.push('/proposta/recebidas')}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="file-document-outline"
            label="Contratos e pagamentos"
            accentColor={colors.success}
            onPress={() => router.push('/contrato/index')}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="cash-multiple"
            label="Meus ganhos"
            accentColor={colors.success}
            comingSoon
            onPress={() => {}}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="wrench-outline"
            label="Manutenção"
            accentColor={colors.success}
            onPress={() => router.push({ pathname: '/manutencao', params: { tab: 'proprietario' } })}
          />
        </View>
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
  roleHeaderCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  roleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userNameText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.navy,
  },
  userEmailText: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.navy,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  contractCard: {
    marginBottom: spacing.md,
  },
  contractHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  contractTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.navy,
    flex: 1,
    marginRight: spacing.sm,
  },
  contractAddress: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
  },
  contractDivider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginVertical: spacing.md,
  },
  contractFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniLabel: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
  },
  contractPrice: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.cyan,
  },
  dueDateText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.navy,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  emptyCardText: {
    fontSize: typography.sizes.sm,
    color: colors.gray,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  alertCard: {
    backgroundColor: '#fff7ed',
    borderColor: '#ffedd5',
    marginBottom: spacing.lg,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  alertBadgeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.black,
  },
  alertSub: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
    marginTop: 2,
  },
  menuSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  menuSectionIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuSectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.navy,
  },
  menuCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  menuRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRowTextCol: {
    flex: 1,
  },
  menuRowLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.black,
  },
  menuRowSublabel: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
    marginTop: 1,
  },
  menuRowBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  menuRowBadgeText: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  comingSoonTag: {
    fontSize: typography.sizes.xs - 1,
    color: colors.gray,
    marginRight: spacing.xs,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginLeft: spacing.md + 36 + spacing.md,
  },
});
