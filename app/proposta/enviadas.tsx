import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
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
import { RentalInterestStatus } from '@/types/database';

const STATUS_LABEL: Record<RentalInterestStatus, string> = {
  pendente: 'Em análise',
  em_analise: 'Em análise',
  aguardando_proprietario: 'Aguardando proprietário',
  auto_aprovado: 'Aprovada',
  aprovado: 'Aprovada',
  recusado: 'Recusada',
  expirado: 'Expirada',
  bloqueada_negociacao: 'Negociação bloqueada',
};

const STATUS_VARIANT: Record<RentalInterestStatus, 'success' | 'warning' | 'error' | 'info'> = {
  pendente: 'warning',
  em_analise: 'warning',
  aguardando_proprietario: 'warning',
  auto_aprovado: 'success',
  aprovado: 'success',
  recusado: 'error',
  expirado: 'error',
  bloqueada_negociacao: 'error',
};

export default function PropostasEnviadasScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const {
    data: proposals = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['sentProposals', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('rental_interests')
        .select('*, property:properties(id, title, rent_amount, address_city, address_neighborhood)')
        .eq('tenant_id', user.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Propostas Enviadas" showBack />

      {isLoading ? (
        <View style={styles.listPadding}>
          <SkeletonCard height={160} />
          <SkeletonCard height={160} />
        </View>
      ) : (
        <FlatList
          data={proposals}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listPadding}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.cyan} />}
          renderItem={({ item }) => (
            <Card
              style={styles.card}
              onPress={() => item.property?.id && router.push(`/imovel/${item.property.id}`)}
            >
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
                  label={STATUS_LABEL[item.status as RentalInterestStatus] || item.status}
                  variant={STATUS_VARIANT[item.status as RentalInterestStatus] || 'info'}
                  size="sm"
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLbl}>Valor anunciado</Text>
                <Text style={styles.infoVal}>{formatPrice(item.property?.rent_amount)}</Text>
              </View>
              {item.tenant_proposed_rent != null && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLbl}>Valor proposto</Text>
                  <Text style={styles.infoVal}>{formatPrice(item.tenant_proposed_rent)}</Text>
                </View>
              )}
              {item.proposed_move_in && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLbl}>Entrada desejada</Text>
                  <Text style={styles.infoVal}>{formatDate(item.proposed_move_in)}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Text style={styles.infoLbl}>Enviada em</Text>
                <Text style={styles.infoVal}>{formatDate(item.created_at)}</Text>
              </View>

              {item.rejection_reason && (
                <View style={styles.rejectionBox}>
                  <Text style={styles.rejectionText}>Motivo: {item.rejection_reason}</Text>
                </View>
              )}
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="send-outline"
              title="Nenhuma proposta enviada"
              subtitle="Quando você manifestar interesse em um imóvel de aluguel mensal, ela aparece aqui."
            />
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
  rejectionBox: {
    backgroundColor: '#fef2f2',
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  rejectionText: {
    fontSize: typography.sizes.xs,
    color: colors.error,
  },
});
