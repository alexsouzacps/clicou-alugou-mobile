import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { MoveInDatePicker } from '@/components/shared/MoveInDatePicker';
import {
  fetchStrPricing,
  fetchStrBlockedDates,
  fetchStrPriceOverrides,
  calculateStrPrice,
  eachNight,
  StrPriceBreakdown,
} from '@/services/strService';
import { StrPricingRow } from '@/types/database';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, radius } from '@/constants/layout';
import { formatPrice } from '@/utils/format';

interface BookingWidgetProps {
  propertyId: string;
  petsAllowed: boolean;
  onBook: (params: {
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    pets: boolean;
  }) => void;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function BookingWidget({ propertyId, petsAllowed, onBook }: BookingWidgetProps) {
  const [pricing, setPricing] = useState<StrPricingRow | null>(null);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [pets, setPets] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [pricingData, blocked] = await Promise.all([
        fetchStrPricing(propertyId),
        fetchStrBlockedDates(propertyId),
      ]);
      setPricing(pricingData);
      setBlockedDates(blocked);

      if (pricingData) {
        const from = new Date();
        const to = addDays(from, pricingData.max_nights + 30);
        const overrides = await fetchStrPriceOverrides(propertyId, toISODate(from), toISODate(to));
        setPriceOverrides(overrides);
      }
      setLoading(false);
    })();
  }, [propertyId]);

  const breakdown: StrPriceBreakdown | null = useMemo(() => {
    if (!pricing || !checkIn || !checkOut || checkOut <= checkIn) return null;
    return calculateStrPrice(pricing, checkIn, checkOut, priceOverrides);
  }, [pricing, checkIn, checkOut, priceOverrides]);

  const totalGuests = adults + children;

  function validate(): string | null {
    if (!pricing) return 'Não foi possível carregar as condições de reserva.';
    if (!checkIn || !checkOut) return 'Selecione as datas de check-in e check-out.';
    if (checkOut <= checkIn) return 'A data de check-out deve ser depois do check-in.';
    if (breakdown && (breakdown.nights < pricing.min_nights || breakdown.nights > pricing.max_nights)) {
      return `Este imóvel exige entre ${pricing.min_nights} e ${pricing.max_nights} noites.`;
    }
    if (totalGuests > pricing.max_guests) {
      return `Este imóvel aceita no máximo ${pricing.max_guests} hóspedes.`;
    }
    const nights = eachNight(checkIn, checkOut);
    if (nights.some((n) => blockedDates.includes(n))) {
      return 'Uma ou mais datas selecionadas já estão indisponíveis. Escolha outro período.';
    }
    return null;
  }

  function handleSubmit() {
    const validationError = validate();
    setError(validationError);
    if (validationError || !checkIn || !checkOut) return;

    onBook({
      checkIn: toISODate(checkIn),
      checkOut: toISODate(checkOut),
      adults,
      children,
      pets,
    });
  }

  if (loading) return null;

  if (!pricing) {
    return (
      <View style={styles.card}>
        <Text style={styles.errorText}>Condições de reserva indisponíveis para este imóvel.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Escolha as datas</Text>

      <View style={styles.dateRow}>
        <View style={styles.dateCol}>
          <Text style={styles.fieldLabel}>Check-in</Text>
          <MoveInDatePicker value={checkIn} onChange={setCheckIn} minimumDate={new Date()} />
        </View>
        <View style={styles.dateCol}>
          <Text style={styles.fieldLabel}>Check-out</Text>
          <MoveInDatePicker
            value={checkOut}
            onChange={setCheckOut}
            minimumDate={checkIn ? addDays(checkIn, 1) : addDays(new Date(), 1)}
          />
        </View>
      </View>

      <Text style={styles.hintText}>
        Mínimo de {pricing.min_nights} {pricing.min_nights === 1 ? 'noite' : 'noites'}, máximo de{' '}
        {pricing.max_nights}.
      </Text>

      <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Hóspedes</Text>
      <View style={styles.counterRow}>
        <Text style={styles.counterLabel}>Adultos</Text>
        <View style={styles.counterControls}>
          <TouchableOpacity
            style={styles.counterButton}
            onPress={() => setAdults((v) => Math.max(1, v - 1))}
          >
            <MaterialCommunityIcons name="minus" size={16} color={colors.navy} />
          </TouchableOpacity>
          <Text style={styles.counterValue}>{adults}</Text>
          <TouchableOpacity
            style={styles.counterButton}
            onPress={() => setAdults((v) => Math.min(pricing.max_guests, v + 1))}
          >
            <MaterialCommunityIcons name="plus" size={16} color={colors.navy} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.counterRow}>
        <Text style={styles.counterLabel}>Crianças</Text>
        <View style={styles.counterControls}>
          <TouchableOpacity
            style={styles.counterButton}
            onPress={() => setChildren((v) => Math.max(0, v - 1))}
          >
            <MaterialCommunityIcons name="minus" size={16} color={colors.navy} />
          </TouchableOpacity>
          <Text style={styles.counterValue}>{children}</Text>
          <TouchableOpacity
            style={styles.counterButton}
            onPress={() => setChildren((v) => Math.min(pricing.max_guests, v + 1))}
          >
            <MaterialCommunityIcons name="plus" size={16} color={colors.navy} />
          </TouchableOpacity>
        </View>
      </View>

      {petsAllowed && (
        <TouchableOpacity style={styles.petsToggleRow} onPress={() => setPets((v) => !v)}>
          <MaterialCommunityIcons
            name={pets ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={20}
            color={pets ? colors.cyan : colors.gray}
          />
          <Text style={styles.petsToggleText}>Vou levar animal de estimação</Text>
        </TouchableOpacity>
      )}

      {breakdown && (
        <View style={styles.priceBreakdown}>
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
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} activeOpacity={0.85}>
        <Text style={styles.submitButtonText}>Reservar Agora</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.navy,
    marginBottom: spacing.sm,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateCol: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.gray,
    marginBottom: spacing.xs,
  },
  hintText: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
    marginTop: spacing.xs,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  counterLabel: {
    fontSize: typography.sizes.sm,
    color: colors.black,
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  counterButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.navy,
    minWidth: 20,
    textAlign: 'center',
  },
  petsToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  petsToggleText: {
    fontSize: typography.sizes.sm,
    color: colors.black,
  },
  priceBreakdown: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: spacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  errorText: {
    fontSize: typography.sizes.xs,
    color: colors.error,
    marginTop: spacing.sm,
  },
  submitButton: {
    backgroundColor: colors.orange,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
});
