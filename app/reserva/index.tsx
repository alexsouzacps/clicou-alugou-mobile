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
import { StrReservationStatus } from '@/types/database';

type Tab = 'hospede' | 'anfitriao';

const STATUS_LABEL: Record<StrReservationStatus, string> = {
  pendente_pagamento: 'Aguardando pagamento',
  confirmada: 'Confirmada',
  ativa: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  expirada: 'Expirada',
  reembolsada: 'Reembolsada',
};

const STATUS_VARIANT: Record<StrReservationStatus, 'success' | 'warning' | 'error' | 'info'> = {
  pendente_pagamento: 'warning',
  confirmada: 'success',
  ativa: 'success',
  concluida: 'info',
  cancelada: 'error',
  expirada: 'error',
  reembolsada: 'error',
};

export default function ReservasScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('hospede');

  const {
    data: reservations = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['strReservations', user?.id, tab],
    queryFn: async () => {
      if (!user) return [];
      const column = tab === 'hospede' ? 'tenant_id' : 'owner_id';
      const { data } = await supabase
        .from('str_reservations')
        .select('*, property:properties(id, title, address_city, address_neighborhood)')
        .eq(column, user.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Reservas de Temporada" showBack />

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'hospede' && styles.tabButtonActive]}
          onPress={() => setTab('hospede')}
        >
          <Text style={[styles.tabText, tab === 'hospede' && styles.tabTextActive]}>Como hóspede</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'anfitriao' && styles.tabButtonActive]}
          onPress={() => setTab('anfitriao')}
        >
          <Text style={[styles.tabText, tab === 'anfitriao' && styles.tabTextActive]}>Como anfitrião</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.listPadding}>
          <SkeletonCard height={160} />
          <SkeletonCard height={160} />
        </View>
      ) : (
        <FlatList
          data={reservations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listPadding}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.cyan} />}
          renderItem={({ item }) => (
            <Card style={styles.card} onPress={() => router.push(`/reserva/${item.id}`)}>
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
                  label={STATUS_LABEL[item.status as StrReservationStatus] || item.status}
                  variant={STATUS_VARIANT[item.status as StrReservationStatus] || 'info'}
                  size="sm"
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLbl}>
                  {formatDate(item.check_in_date)} — {formatDate(item.check_out_date)}
                </Text>
                <Text style={styles.infoVal}>{item.num_nights} noites</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLbl}>{item.num_guests} hóspedes</Text>
                <Text style={styles.totalVal}>{formatPrice(item.total_amount)}</Text>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="bag-suitcase-outline"
              title={tab === 'hospede' ? 'Nenhuma reserva feita' : 'Nenhuma reserva recebida'}
              subtitle={
                tab === 'hospede'
                  ? 'Suas reservas de temporada aparecem aqui depois da confirmação do pagamento.'
                  : 'Reservas feitas nos seus imóveis de temporada aparecem aqui.'
              }
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
