import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { supabase } from '@/services/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, radius } from '@/constants/layout';
import { formatDate } from '@/utils/format';

type Tab = 'locatario' | 'proprietario';

export default function ManutencaoIndexScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(
    tabParam || (profile?.role === 'proprietario' ? 'proprietario' : 'locatario')
  );

  const {
    data: requests = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['maintenanceRequests', user?.id, tab],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('maintenance_requests')
        .select('*, property:properties(title)');

      if (tab === 'proprietario') {
        // Chamados recebidos nos imóveis que o usuário possui — exceto os que
        // ele mesmo abriu (senão o próprio chamado dele aparece duplicado
        // também na caixa de "recebidos dos meus inquilinos").
        const { data: props } = await supabase
          .from('properties')
          .select('id')
          .eq('owner_id', user.id);

        const propIds = (props || []).map((p) => p.id);
        if (propIds.length === 0) return [];

        query = query.in('property_id', propIds).neq('reporter_id', user.id);
      } else {
        // Chamados que o usuário mesmo abriu (como locatário)
        query = query.eq('reporter_id', user.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Chamados de Manutenção"
        showBack
        rightAction={
          tab === 'locatario'
            ? {
                icon: 'plus',
                onPress: () => router.push('/manutencao/nova'),
              }
            : undefined
        }
      />

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'locatario' && styles.tabButtonActive]}
          onPress={() => setTab('locatario')}
        >
          <Text style={[styles.tabText, tab === 'locatario' && styles.tabTextActive]}>Meus chamados</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'proprietario' && styles.tabButtonActive]}
          onPress={() => setTab('proprietario')}
        >
          <Text style={[styles.tabText, tab === 'proprietario' && styles.tabTextActive]}>
            Recebidos nos meus imóveis
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.listPadding}>
          <SkeletonCard height={140} />
          <SkeletonCard height={140} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listPadding}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.cyan} />}
          renderItem={({ item }) => {
            const isFinished = item.status === 'concluido';
            const isPending = item.status === 'solicitado' || item.status === 'em_analise';

            return (
              <Card
                onPress={() => router.push(`/manutencao/${item.id}`)}
                style={styles.card}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ticketTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.propertyTitle}>{item.property?.title}</Text>
                  </View>
                  <Badge
                    label={item.status.replace('_', ' ').toUpperCase()}
                    variant={isFinished ? 'success' : isPending ? 'warning' : 'info'}
                    size="sm"
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.cardFooter}>
                  <View style={styles.categoryRow}>
                    <MaterialCommunityIcons name="wrench-outline" size={16} color={colors.navy} />
                    <Text style={styles.categoryText}>{item.category}</Text>
                  </View>
                  <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
                </View>
              </Card>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="wrench-outline"
              title="Nenhum chamado de manutenção"
              subtitle={
                tab === 'proprietario'
                  ? 'Nenhum chamado de manutenção foi registrado para os seus imóveis.'
                  : 'Você não tem chamados de manutenção abertos no momento.'
              }
              action={
                tab === 'locatario'
                  ? {
                      label: 'Abrir Novo Chamado',
                      onPress: () => router.push('/manutencao/nova'),
                    }
                  : undefined
              }
            />
          }
        />
      )}

      {tab === 'locatario' && (
        <View style={styles.floatingButtonContainer}>
          <Button
            label="Abrir Novo Chamado"
            onPress={() => router.push('/manutencao/nova')}
            icon="plus"
            fullWidth
          />
        </View>
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
    textAlign: 'center',
  },
  tabTextActive: {
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  listPadding: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: 90,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  ticketTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.navy,
  },
  propertyTitle: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginVertical: spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  categoryText: {
    fontSize: typography.sizes.xs,
    color: colors.navy,
    fontWeight: typography.weights.medium,
    textTransform: 'capitalize',
  },
  dateText: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
  },
});
