import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { supabase } from '@/services/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, radius } from '@/constants/layout';
import { formatPrice, formatDate } from '@/utils/format';
import { ContractStatus, PaymentStatus } from '@/types/database';

type Tab = 'contratos' | 'pagamentos';

const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  rascunho: 'Rascunho',
  aguardando_aceite: 'Aguardando aceite',
  ativo: 'Ativo',
  encerrado: 'Encerrado',
  cancelado: 'Cancelado',
  rescindido: 'Rescindido',
  suspenso: 'Suspenso',
};

const CONTRACT_STATUS_VARIANT: Record<ContractStatus, 'success' | 'warning' | 'error' | 'info'> = {
  rascunho: 'info',
  aguardando_aceite: 'warning',
  ativo: 'success',
  encerrado: 'info',
  cancelado: 'error',
  rescindido: 'error',
  suspenso: 'warning',
};

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  falha: 'Falhou',
  estornado: 'Estornado',
};

const PAYMENT_STATUS_VARIANT: Record<PaymentStatus, 'success' | 'warning' | 'error' | 'info'> = {
  pendente: 'warning',
  pago: 'success',
  falha: 'error',
  estornado: 'error',
};

export default function ContratosScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('contratos');

  const {
    data: contracts = [],
    isLoading: loadingContracts,
    refetch: refetchContracts,
  } = useQuery({
    queryKey: ['myContracts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('contracts')
        .select('*, property:properties(id, title, address_city, address_neighborhood)')
        .or(`tenant_id.eq.${user.id},owner_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user && tab === 'contratos',
  });

  const {
    data: payments = [],
    isLoading: loadingPayments,
    refetch: refetchPayments,
  } = useQuery({
    queryKey: ['myPayments', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: asTenant } = await supabase
        .from('payments')
        .select('*, contract:contracts(property:properties(title))')
        .eq('tenant_id', user.id);

      const { data: ownerContracts } = await supabase
        .from('contracts')
        .select('id')
        .eq('owner_id', user.id);

      const ownerContractIds = (ownerContracts || []).map((c) => c.id);
      let asOwner: any[] = [];
      if (ownerContractIds.length > 0) {
        const { data } = await supabase
          .from('payments')
          .select('*, contract:contracts(property:properties(title))')
          .in('contract_id', ownerContractIds);
        asOwner = (data || []).map((p) => ({ ...p, _direction: 'recebe' as const }));
      }

      const tenantRows = (asTenant || []).map((p) => ({ ...p, _direction: 'paga' as const }));

      return [...tenantRows, ...asOwner].sort(
        (a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()
      );
    },
    enabled: !!user && tab === 'pagamentos',
  });

  const isLoading = tab === 'contratos' ? loadingContracts : loadingPayments;
  const handleRefresh = tab === 'contratos' ? refetchContracts : refetchPayments;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Contratos e Pagamentos" showBack />

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'contratos' && styles.tabButtonActive]}
          onPress={() => setTab('contratos')}
        >
          <Text style={[styles.tabText, tab === 'contratos' && styles.tabTextActive]}>Contratos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'pagamentos' && styles.tabButtonActive]}
          onPress={() => setTab('pagamentos')}
        >
          <Text style={[styles.tabText, tab === 'pagamentos' && styles.tabTextActive]}>Pagamentos</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.listPadding}>
          <SkeletonCard height={140} />
          <SkeletonCard height={140} />
        </View>
      ) : tab === 'contratos' ? (
        <FlatList
          data={contracts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listPadding}
          refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={colors.cyan} />}
          renderItem={({ item }) => (
            <Card style={styles.card} onPress={() => router.push(`/contrato/${item.id}`)}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.propertyTitle} numberOfLines={1}>
                    {item.property?.title || 'Imóvel'}
                  </Text>
                  <Text style={styles.propertyLocation} numberOfLines={1}>
                    {item.property?.address_neighborhood}, {item.property?.address_city}
                  </Text>
                </View>
                <Badge
                  label={CONTRACT_STATUS_LABEL[item.status as ContractStatus] || item.status}
                  variant={CONTRACT_STATUS_VARIANT[item.status as ContractStatus] || 'info'}
                  size="sm"
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLbl}>Aluguel mensal</Text>
                <Text style={styles.totalVal}>{formatPrice(item.rent_amount)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLbl}>Vencimento</Text>
                <Text style={styles.infoVal}>Todo dia {item.due_day}</Text>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState icon="file-document-outline" title="Nenhum contrato" subtitle="Seus contratos de locação aparecem aqui." />
          }
        />
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listPadding}
          refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={colors.cyan} />}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.propertyTitle} numberOfLines={1}>
                    {item.contract?.property?.title || 'Imóvel'}
                  </Text>
                  <Text style={styles.propertyLocation}>
                    {item._direction === 'paga' ? 'Você paga' : 'Você recebe'} ·{' '}
                    {formatDate(item.reference_month)}
                  </Text>
                </View>
                <Badge
                  label={PAYMENT_STATUS_LABEL[item.status as PaymentStatus] || item.status}
                  variant={PAYMENT_STATUS_VARIANT[item.status as PaymentStatus] || 'info'}
                  size="sm"
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLbl}>Vencimento</Text>
                <Text style={styles.infoVal}>{formatDate(item.due_date)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLbl}>Valor</Text>
                <Text style={styles.totalVal}>
                  {formatPrice(item._direction === 'paga' ? item.amount : item.owner_amount)}
                </Text>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState icon="cash-multiple" title="Nenhum pagamento" subtitle="Seu histórico de pagamentos aparece aqui." />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.default,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bg.input,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: colors.navy,
  },
  tabText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.gray,
  },
  tabTextActive: {
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  listPadding: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  propertyTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.navy,
  },
  propertyLocation: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginVertical: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  infoLbl: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
  },
  infoVal: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.black,
  },
  totalVal: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.cyan,
  },
});
