import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { supabase } from '@/services/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing } from '@/constants/layout';
import { formatPrice, formatDate } from '@/utils/format';
import { ReservationWithProperty } from '@/types/app';

export default function ReservaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [reservation, setReservation] = useState<ReservationWithProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadReservation();
  }, [id]);

  async function loadReservation() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('str_reservations')
        .select(
          '*, property:properties(id, title, address_city, address_neighborhood), owner:profiles!str_reservations_owner_id_fkey(full_name, phone), tenant:profiles!str_reservations_tenant_id_fkey(full_name, phone)'
        )
        .eq('id', id)
        .single();

      setReservation(data as any);

      const { data: roomData } = await supabase.rpc('get_or_create_chat_room', {
        p_context_type: 'str_reservation',
        p_context_id: id,
      });

      if (roomData) {
        setRoomId(roomData as string);
      }
    } catch (err) {
      console.warn('[ReservaDetail] Erro:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen message="Carregando reserva..." />;
  }

  if (!reservation) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Reserva" showBack />
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Reserva não encontrada.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isConfirmed = reservation.status === 'confirmada';

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Detalhes da Reserva STR" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Header */}
        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.resLabel}>Reserva Temporada #{reservation.id.slice(0, 8)}</Text>
              <Text style={styles.propertyTitle}>{reservation.property?.title}</Text>
            </View>
            <Badge
              label={reservation.status.toUpperCase()}
              variant={isConfirmed ? 'success' : 'warning'}
              size="md"
            />
          </View>

          <View style={styles.divider} />

          <Text style={styles.addressText}>
            <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.gray} />{' '}
            {reservation.property?.address_neighborhood}, {reservation.property?.address_city}
          </Text>
        </Card>

        {/* Datas & Hóspedes */}
        <Text style={styles.sectionHeader}>Estadia</Text>
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLbl}>Check-in</Text>
            <Text style={styles.infoValBold}>{formatDate(reservation.check_in_date)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLbl}>Check-out</Text>
            <Text style={styles.infoValBold}>{formatDate(reservation.check_out_date)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLbl}>Duração</Text>
            <Text style={styles.infoVal}>{reservation.num_nights} noites</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLbl}>Hóspedes</Text>
            <Text style={styles.infoVal}>{reservation.num_guests} pessoas</Text>
          </View>
          {reservation.has_pet && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLbl}>Pet</Text>
              <Text style={styles.infoVal}>Sim</Text>
            </View>
          )}
        </Card>

        {/* Resumo Financeiro */}
        <Text style={styles.sectionHeader}>Resumo de Valores</Text>
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLbl}>Diárias ({reservation.num_nights}x)</Text>
            <Text style={styles.infoVal}>{formatPrice(reservation.subtotal_nights)}</Text>
          </View>
          {reservation.cleaning_fee > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLbl}>Taxa de Limpeza</Text>
              <Text style={styles.infoVal}>{formatPrice(reservation.cleaning_fee)}</Text>
            </View>
          )}
          {reservation.daily_cleaning_total > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLbl}>Limpeza Diária</Text>
              <Text style={styles.infoVal}>{formatPrice(reservation.daily_cleaning_total)}</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.totalLbl}>Total da Reserva</Text>
            <Text style={styles.totalVal}>{formatPrice(reservation.total_amount)}</Text>
          </View>
        </Card>

        {/* Chat */}
        {roomId && (
          <Button
            label="Abrir Chat com o Anfitrião"
            onPress={() => router.push(`/chat/${roomId}`)}
            icon="chat-outline"
            fullWidth
            style={{ marginTop: spacing.md, marginBottom: spacing.xl }}
          />
        )}
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
  resLabel: {
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
  totalLbl: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.navy,
  },
  totalVal: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.cyan,
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
