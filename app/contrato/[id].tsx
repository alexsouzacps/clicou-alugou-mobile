import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { supabase } from '@/services/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, radius } from '@/constants/layout';
import { formatPrice, formatDate } from '@/utils/format';
import { ContractWithProperty } from '@/types/app';

export default function ContratoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [contract, setContract] = useState<ContractWithProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadContract();
  }, [id]);

  async function loadContract() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('contracts')
        .select(
          '*, property:properties(id, title, address_street, address_number, address_city, rent_amount), owner:profiles!contracts_owner_id_fkey(full_name, phone, email), tenant:profiles!contracts_tenant_id_fkey(full_name, phone, email)'
        )
        .eq('id', id)
        .single();

      setContract(data as any);

      // Busca ou cria sala de chat para este contrato
      const { data: roomData } = await supabase.rpc('get_or_create_chat_room', {
        p_context_type: 'contract',
        p_context_id: id,
      });

      if (roomData) {
        setRoomId(roomData as string);
      }
    } catch (err) {
      console.warn('[ContratoDetail] Erro:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen message="Carregando contrato..." />;
  }

  if (!contract) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Contrato" showBack />
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Contrato não encontrado.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isAtivo = contract.status === 'ativo';

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Detalhes do Contrato" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Header */}
        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.contractLabel}>Contrato LTR #{contract.id.slice(0, 8)}</Text>
              <Text style={styles.propertyTitle}>{contract.property?.title}</Text>
            </View>
            <Badge
              label={contract.status.toUpperCase()}
              variant={isAtivo ? 'success' : 'neutral'}
              size="md"
            />
          </View>

          <View style={styles.divider} />

          <Text style={styles.addressText}>
            <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.gray} />{' '}
            {contract.property?.address_street}, {contract.property?.address_number} —{' '}
            {contract.property?.address_city}
          </Text>
        </Card>

        {/* Valores */}
        <Text style={styles.sectionHeader}>Valores & Pagamento</Text>
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLbl}>Aluguel mensal</Text>
            <Text style={styles.infoValHighlight}>{formatPrice(contract.rent_amount)}</Text>
          </View>

          {contract.condo_fee != null && contract.condo_fee > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLbl}>Condomínio estimado</Text>
              <Text style={styles.infoVal}>{formatPrice(contract.condo_fee)}</Text>
            </View>
          )}

          {contract.iptu_amount != null && contract.iptu_amount > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLbl}>IPTU mensal</Text>
              <Text style={styles.infoVal}>{formatPrice(contract.iptu_amount)}</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLbl}>Dia de Vencimento</Text>
            <Text style={styles.infoValBold}>Todo dia {contract.due_day}</Text>
          </View>
        </Card>

        {/* Vigência */}
        <Text style={styles.sectionHeader}>Vigência</Text>
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLbl}>Início</Text>
            <Text style={styles.infoVal}>{formatDate(contract.start_date)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLbl}>Término</Text>
            <Text style={styles.infoVal}>{formatDate(contract.end_date)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLbl}>Duração</Text>
            <Text style={styles.infoValBold}>{contract.duration_months} meses</Text>
          </View>
        </Card>

        {/* Atalhos Rápidos */}
        <View style={styles.actionsRow}>
          {roomId && (
            <Button
              label="Abrir Chat"
              onPress={() => router.push(`/chat/${roomId}`)}
              icon="chat-outline"
              fullWidth
              style={{ marginBottom: spacing.md }}
            />
          )}

          <Button
            label="Abrir Chamado de Manutenção"
            onPress={() => router.push({ pathname: '/manutencao/nova', params: { propertyId: contract.property_id } })}
            variant="secondary"
            icon="wrench-outline"
            fullWidth
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
  statusCard: {
    marginBottom: spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  contractLabel: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
  },
  propertyTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.navy,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginVertical: spacing.md,
  },
  addressText: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
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
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  infoLbl: {
    fontSize: typography.sizes.sm,
    color: colors.gray,
  },
  infoVal: {
    fontSize: typography.sizes.sm,
    color: colors.black,
  },
  infoValBold: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.navy,
  },
  infoValHighlight: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.cyan,
  },
  actionsRow: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  errorBox: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  errorText: {
    fontSize: typography.sizes.base,
    color: colors.gray,
  },
});
