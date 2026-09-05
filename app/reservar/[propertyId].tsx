import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { safeImpactAsync, safeNotificationAsync } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { fetchPropertyById } from '@/services/propertyService';
import {
  fetchStrPricing,
  fetchStrPriceOverrides,
  calculateStrPrice,
  checkoutStrReservation,
  StrCheckoutResult,
  StrPaymentMethodInput,
} from '@/services/strService';
import { supabase } from '@/services/supabase';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { showAlert } from '@/utils/crossAlert';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, radius } from '@/constants/layout';
import { formatPrice } from '@/utils/format';
import { PropertyCardItem } from '@/types/app';
import { StrPricingRow } from '@/types/database';

const CANCELLATION_LABEL: Record<string, string> = {
  flexivel: 'Cancelamento grátis até 24h antes do check-in.',
  moderada: 'Reembolso integral se cancelar com 5 dias ou mais de antecedência.',
  rigorosa: 'Reembolso de 50% se cancelar com 14 dias ou mais de antecedência. Sem reembolso depois disso.',
};

const PAYMENT_METHODS: { key: StrPaymentMethodInput; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { key: 'pix', label: 'Pix', icon: 'qrcode' },
  { key: 'credit_card', label: 'Cartão de crédito', icon: 'credit-card-outline' },
  { key: 'boleto', label: 'Boleto', icon: 'barcode' },
];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function ReservarScreen() {
  const params = useLocalSearchParams<{
    propertyId: string;
    checkIn: string;
    checkOut: string;
    adults: string;
    children: string;
    pets: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();

  const [property, setProperty] = useState<PropertyCardItem | null>(null);
  const [pricing, setPricing] = useState<StrPricingRow | null>(null);
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<StrPaymentMethodInput>('pix');
  const [result, setResult] = useState<StrCheckoutResult | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);

  const adults = Number(params.adults) || 1;
  const children = Number(params.children) || 0;
  const pets = params.pets === '1';

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [propertyData, pricingData] = await Promise.all([
        fetchPropertyById(params.propertyId),
        fetchStrPricing(params.propertyId),
      ]);
      setProperty(propertyData);
      setPricing(pricingData);
      if (pricingData) {
        const overrides = await fetchStrPriceOverrides(params.propertyId, params.checkIn, params.checkOut);
        setPriceOverrides(overrides);
      }
      setLoading(false);
    })();
  }, [params.propertyId, params.checkIn, params.checkOut]);

  const breakdown = useMemo(() => {
    if (!pricing) return null;
    return calculateStrPrice(pricing, new Date(`${params.checkIn}T00:00:00`), new Date(`${params.checkOut}T00:00:00`), priceOverrides);
  }, [pricing, params.checkIn, params.checkOut, priceOverrides]);

  const isBoletoDisabled = useMemo(() => {
    const checkInDate = new Date(`${params.checkIn}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((checkInDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays < 3;
  }, [params.checkIn]);

  async function handleConfirm() {
    if (!user) {
      showAlert('Login necessário', 'Faça login para concluir a reserva.', [
        { text: 'OK', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }
    safeImpactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    const res = await checkoutStrReservation({
      propertyId: params.propertyId,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      adults,
      children,
      pets,
      paymentMethod,
    });
    setSubmitting(false);

    if (res.error) {
      showAlert('Não foi possível concluir', res.error);
      return;
    }

    safeNotificationAsync(Haptics.NotificationFeedbackType.Success);
    setResult(res);

    if (paymentMethod === 'credit_card' && res.invoiceUrl) {
      Linking.openURL(res.invoiceUrl);
    }
  }

  async function handleCheckPixPaid() {
    if (!result?.reservationId) return;
    setCheckingPayment(true);
    const { data } = await supabase
      .from('str_reservations')
      .select('status')
      .eq('id', result.reservationId)
      .single();
    setCheckingPayment(false);

    if (data?.status === 'confirmada') {
      safeNotificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert('Pagamento confirmado! 🎉', 'Sua reserva está confirmada.', [
        { text: 'Ver reserva', onPress: () => router.replace(`/reserva/${result.reservationId}`) },
      ]);
    } else {
      showAlert('Ainda não identificamos o pagamento', 'Aguarde alguns instantes e tente novamente.');
    }
  }

  async function handleCopyPix() {
    if (!result?.copyPaste) return;
    await Clipboard.setStringAsync(result.copyPaste);
    showAlert('Copiado!', 'Código Pix copiado para a área de transferência.');
  }

  if (loading) {
    return <LoadingSpinner fullScreen message="Carregando reserva..." />;
  }

  if (!property || !pricing || !breakdown) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Reserva" showBack />
        <Card style={styles.cardPadding}>
          <Text style={styles.cardTitle}>Não foi possível carregar esta reserva.</Text>
        </Card>
      </SafeAreaView>
    );
  }

  // ── Resultado do pagamento ──
  if (result) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Pagamento" showBack={false} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {paymentMethod === 'pix' && (
            <Card style={styles.cardPadding}>
              <Text style={styles.cardTitle}>Pague com Pix</Text>
              {result.qrCode && (
                <View style={styles.pixQrWrapper}>
                  <Image
                    source={{ uri: `data:image/png;base64,${result.qrCode}` }}
                    style={{ width: 220, height: 220 }}
                    contentFit="contain"
                  />
                </View>
              )}
              {result.copyPaste && (
                <>
                  <Text style={styles.pixCode} numberOfLines={3}>
                    {result.copyPaste}
                  </Text>
                  <Button label="Copiar código Pix" onPress={handleCopyPix} variant="secondary" fullWidth style={{ marginTop: spacing.sm }} />
                </>
              )}
              {result.qrCodePending && (
                <Text style={styles.cardSub}>
                  Estamos gerando seu QR Code. Toque em "Já paguei" em alguns instantes para verificar.
                </Text>
              )}
              <Button
                label="Já paguei"
                onPress={handleCheckPixPaid}
                loading={checkingPayment}
                fullWidth
                style={{ marginTop: spacing.md }}
              />
            </Card>
          )}

          {paymentMethod === 'boleto' && (
            <Card style={styles.cardPadding}>
              <Text style={styles.cardTitle}>Boleto gerado</Text>
              <Text style={styles.cardSub}>
                Vencimento em até 2 dias. Sua reserva será confirmada assim que o pagamento for compensado.
              </Text>
              {result.barCode && <Text style={styles.pixCode}>{result.barCode}</Text>}
              {result.bankSlipUrl && (
                <Button
                  label="Abrir boleto"
                  onPress={() => Linking.openURL(result.bankSlipUrl!)}
                  fullWidth
                  style={{ marginTop: spacing.md }}
                />
              )}
            </Card>
          )}

          {paymentMethod === 'credit_card' && (
            <Card style={styles.cardPadding}>
              <Text style={styles.cardTitle}>Pagamento com cartão</Text>
              <Text style={styles.cardSub}>
                Abrimos a página segura de pagamento no navegador. Volte aqui depois de concluir.
              </Text>
              {result.invoiceUrl && (
                <Button
                  label="Abrir pagamento"
                  onPress={() => Linking.openURL(result.invoiceUrl!)}
                  fullWidth
                  style={{ marginTop: spacing.md }}
                />
              )}
            </Card>
          )}

          <Button
            label="Ir para Minha Área"
            onPress={() => router.replace('/(tabs)/dashboard')}
            variant="secondary"
            fullWidth
            style={{ marginTop: spacing.lg }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Revisão / checkout ──
  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Revisar e Pagar" showBack />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.cardPadding}>
          <Text style={styles.cardTitle}>{property.title}</Text>
          <View style={styles.tripRow}>
            <MaterialCommunityIcons name="calendar-range" size={18} color={colors.gray} />
            <Text style={styles.tripText}>
              {formatDate(params.checkIn)} — {formatDate(params.checkOut)} · {breakdown.nights}{' '}
              {breakdown.nights === 1 ? 'noite' : 'noites'}
            </Text>
          </View>
          <View style={styles.tripRow}>
            <MaterialCommunityIcons name="account-group-outline" size={18} color={colors.gray} />
            <Text style={styles.tripText}>
              {adults + children} {adults + children === 1 ? 'hóspede' : 'hóspedes'}
              {pets ? ' · com pet' : ''}
            </Text>
          </View>
        </Card>

        <Card style={styles.cardPadding}>
          <Text style={styles.sectionTitle}>Política de cancelamento</Text>
          <Text style={styles.cardSub}>
            {CANCELLATION_LABEL[pricing.cancellation_policy] || 'Consulte as regras do anúncio.'}
          </Text>
        </Card>

        <Card style={styles.cardPadding}>
          <Text style={styles.sectionTitle}>Resumo de valores</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>
              {formatPrice(pricing.base_price)} x {breakdown.nights}{' '}
              {breakdown.nights === 1 ? 'noite' : 'noites'}
            </Text>
            <Text style={styles.priceValue}>{formatPrice(breakdown.subtotalNights)}</Text>
          </View>
          {breakdown.cleaningFee > 0 && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Limpeza de saída</Text>
              <Text style={styles.priceValue}>{formatPrice(breakdown.cleaningFee)}</Text>
            </View>
          )}
          {breakdown.dailyCleaningTotal > 0 && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Limpeza diária</Text>
              <Text style={styles.priceValue}>{formatPrice(breakdown.dailyCleaningTotal)}</Text>
            </View>
          )}
          <View style={[styles.priceRow, styles.priceTotalRow]}>
            <Text style={styles.priceTotalLabel}>Total</Text>
            <Text style={styles.priceTotalValue}>{formatPrice(breakdown.total)}</Text>
          </View>
        </Card>

        <Card style={styles.cardPadding}>
          <Text style={styles.sectionTitle}>Forma de pagamento</Text>
          {PAYMENT_METHODS.map((method) => {
            const disabled = method.key === 'boleto' && isBoletoDisabled;
            return (
              <TouchableOpacity
                key={method.key}
                style={[
                  styles.paymentOption,
                  paymentMethod === method.key && styles.paymentOptionSelected,
                  disabled && styles.paymentOptionDisabled,
                ]}
                onPress={() => !disabled && setPaymentMethod(method.key)}
                disabled={disabled}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name={method.icon}
                  size={20}
                  color={disabled ? colors.gray : paymentMethod === method.key ? colors.blue : colors.navy}
                />
                <Text style={[styles.paymentOptionText, disabled && styles.paymentOptionTextDisabled]}>
                  {method.label}
                  {disabled ? ' (indisponível a menos de 3 dias do check-in)' : ''}
                </Text>
                {paymentMethod === method.key && !disabled && (
                  <MaterialCommunityIcons name="check-circle" size={18} color={colors.blue} />
                )}
              </TouchableOpacity>
            );
          })}
        </Card>

        <Button
          label={`Confirmar e Pagar ${formatPrice(breakdown.total)}`}
          onPress={handleConfirm}
          loading={submitting}
          fullWidth
          style={{ marginTop: spacing.md }}
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
    gap: spacing.md,
  },
  cardPadding: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.navy,
    marginBottom: spacing.sm,
  },
  cardSub: {
    fontSize: typography.sizes.sm,
    color: colors.gray,
    lineHeight: 20,
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  tripText: {
    fontSize: typography.sizes.sm,
    color: colors.black,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.navy,
    marginBottom: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  priceLabel: {
    fontSize: typography.sizes.sm,
    color: colors.gray,
  },
  priceValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.black,
  },
  priceTotalRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  priceTotalLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.navy,
  },
  priceTotalValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.orange,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.sm,
  },
  paymentOptionSelected: {
    borderColor: colors.blue,
    backgroundColor: colors.bg.tenant,
  },
  paymentOptionDisabled: {
    opacity: 0.5,
  },
  paymentOptionText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.black,
  },
  paymentOptionTextDisabled: {
    color: colors.gray,
  },
  pixQrWrapper: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  pixCode: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
    backgroundColor: colors.bg.input,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
});
