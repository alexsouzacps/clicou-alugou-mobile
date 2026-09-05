import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { safeImpactAsync, safeNotificationAsync } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { supabase } from '@/services/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, radius } from '@/constants/layout';
import { formatPrice, formatDate } from '@/utils/format';

export default function PropostasRecebidasScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const {
    data: proposals = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['receivedProposals', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: props } = await supabase
        .from('properties')
        .select('id')
        .eq('owner_id', user.id);

      const propIds = (props || []).map((p) => p.id);
      if (propIds.length === 0) return [];

      const { data } = await supabase
        .from('rental_interests')
        .select(
          '*, tenant:profiles!rental_interests_tenant_id_fkey(full_name, phone, email), property:properties(id, title, rent_amount, address_city)'
        )
        .in('property_id', propIds)
        .order('created_at', { ascending: false });

      return data || [];
    },
    enabled: !!user,
  });

  async function handleApprove(proposalId: string) {
    Alert.alert('Aprovar Proposta', 'Deseja aceitar esta proposta e prosseguir para a geração do contrato?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aprovar',
        onPress: async () => {
          setActionLoadingId(proposalId);
          safeImpactAsync(Haptics.ImpactFeedbackStyle.Medium);

          const { error } = await supabase
            .from('rental_interests')
            .update({ status: 'aprovado', reviewed_at: new Date().toISOString() })
            .eq('id', proposalId);

          setActionLoadingId(null);

          if (error) {
            Alert.alert('Erro', error.message);
          } else {
            safeNotificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Sucesso 🎉', 'Proposta aprovada!');
            queryClient.invalidateQueries({ queryKey: ['receivedProposals'] });
          }
        },
      },
    ]);
  }

  async function handleReject(proposalId: string) {
    Alert.alert('Recusar Proposta', 'Tem certeza que deseja recusar esta proposta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Recusar',
        style: 'destructive',
        onPress: async () => {
          setActionLoadingId(proposalId);
          safeImpactAsync(Haptics.ImpactFeedbackStyle.Heavy);

          const { error } = await supabase
            .from('rental_interests')
            .update({ status: 'recusado', reviewed_at: new Date().toISOString() })
            .eq('id', proposalId);

          setActionLoadingId(null);

          if (error) {
            Alert.alert('Erro', error.message);
          } else {
            queryClient.invalidateQueries({ queryKey: ['receivedProposals'] });
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Propostas Recebidas" showBack role="owner" />

      {isLoading ? (
        <View style={styles.listPadding}>
          <SkeletonCard height={200} />
          <SkeletonCard height={200} />
        </View>
      ) : (
        <FlatList
          data={proposals}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listPadding}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.success} />}
          renderItem={({ item }) => {
            const isPending = item.status === 'pendente';

            return (
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.tenantName}>{item.tenant?.full_name || 'Locatário Interessado'}</Text>
                    <Text style={styles.propertyTitle}>{item.property?.title}</Text>
                  </View>
                  <Badge
                    label={item.status.toUpperCase()}
                    variant={isPending ? 'warning' : item.status === 'aprovado' ? 'success' : 'error'}
                    size="sm"
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.infoRow}>
                  <Text style={styles.infoLbl}>Renda mensal informada:</Text>
                  <Text style={styles.infoVal}>{formatPrice(item.monthly_income)}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLbl}>Data do envio:</Text>
                  <Text style={styles.infoVal}>{formatDate(item.created_at)}</Text>
                </View>

                {item.message && (
                  <View style={styles.messageBox}>
                    <Text style={styles.messageText}>"{item.message}"</Text>
                  </View>
                )}

                {isPending && (
                  <View style={styles.actionRow}>
                    <Button
                      label="Recusar"
                      onPress={() => handleReject(item.id)}
                      variant="danger"
                      size="sm"
                      loading={actionLoadingId === item.id}
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="Aprovar Proposta"
                      onPress={() => handleApprove(item.id)}
                      size="sm"
                      loading={actionLoadingId === item.id}
                      style={{ flex: 1.5, backgroundColor: colors.success }}
                    />
                  </View>
                )}
              </Card>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="clipboard-check-outline"
              title="Nenhuma proposta recebida"
              subtitle="Você não possui propostas pendentes para seus imóveis no momento."
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
  },
  tenantName: {
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
  messageBox: {
    backgroundColor: colors.bg.input,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  messageText: {
    fontSize: typography.sizes.xs,
    fontStyle: 'italic',
    color: colors.black,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
});
