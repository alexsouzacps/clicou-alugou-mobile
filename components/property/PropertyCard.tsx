import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { safeImpactAsync } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { radius, shadow, spacing } from '@/constants/layout';
import { formatPrice } from '@/utils/format';
import { PropertyCardItem } from '@/types/app';
import { Badge } from '@/components/ui/Badge';

interface PropertyCardProps {
  property: PropertyCardItem;
  onPress: () => void;
  onFavoriteToggle?: () => void;
  isFavorite?: boolean;
}

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=800&auto=format&fit=crop';

export function PropertyCard({
  property,
  onPress,
  onFavoriteToggle,
  isFavorite = false,
}: PropertyCardProps) {
  const isStr = property.rental_type === 'curta_duracao';
  const price = isStr ? property.base_price : property.rent_amount;

  const coverUrl =
    property.cover_image_url ||
    property.property_media?.find((m) => m.is_cover)?.url ||
    property.property_media?.[0]?.url ||
    FALLBACK_IMAGE;

  const handleFavorite = (e: any) => {
    e.stopPropagation();
    safeImpactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onFavoriteToggle) onFavoriteToggle();
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Imagem de Capa */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: coverUrl }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />

        {/* Chip Temporada / Aluguel Mensal */}
        <View style={styles.badgeContainer}>
          <Badge
            label={isStr ? 'Temporada' : 'Aluguel Mensal'}
            variant={isStr ? 'info' : 'success'}
            size="sm"
          />
        </View>

        {/* Botão de Favorito */}
        {onFavoriteToggle && (
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={handleFavorite}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={20}
              color={isFavorite ? colors.error : colors.navy}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Conteúdo Informático */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {property.title}
        </Text>

        <Text style={styles.address} numberOfLines={1}>
          <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.gray} />{' '}
          {property.address_neighborhood}, {property.address_city}
        </Text>

        {/* Features / Specs */}
        <View style={styles.specsRow}>
          <View style={styles.specItem}>
            <MaterialCommunityIcons name="bed-king-outline" size={16} color={colors.navy} />
            <Text style={styles.specText}>{property.bedrooms} qts</Text>
          </View>
          <View style={styles.specItem}>
            <MaterialCommunityIcons name="shower" size={16} color={colors.navy} />
            <Text style={styles.specText}>{property.bathrooms} ban</Text>
          </View>
          <View style={styles.specItem}>
            <MaterialCommunityIcons name="arrow-all" size={16} color={colors.navy} />
            <Text style={styles.specText}>{property.area_useful || 0}m²</Text>
          </View>
          {property.parking_spots > 0 && (
            <View style={styles.specItem}>
              <MaterialCommunityIcons name="car-outline" size={16} color={colors.navy} />
              <Text style={styles.specText}>{property.parking_spots} vag</Text>
            </View>
          )}
        </View>

        {/* Preço */}
        <View style={styles.priceRow}>
          <Text style={styles.priceText}>{formatPrice(price)}</Text>
          <Text style={styles.pricePeriod}>{isStr ? ' / noite' : ' / mês'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginVertical: spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadow.md,
  },
  imageContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
    backgroundColor: colors.bg.skeleton,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badgeContainer: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
  },
  favoriteButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.white,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  content: {
    padding: spacing.md,
  },
  title: {
    fontFamily: typography.fonts.bold,
    fontSize: typography.sizes.base,
    color: colors.navy,
    marginBottom: spacing.xs,
  },
  address: {
    fontFamily: typography.fonts.medium,
    fontSize: typography.sizes.sm,
    color: colors.gray,
    marginBottom: spacing.md,
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  specText: {
    fontFamily: typography.fonts.medium,
    fontSize: typography.sizes.xs,
    color: colors.black,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingTop: spacing.sm,
  },
  priceText: {
    fontFamily: typography.fonts.bold,
    fontSize: typography.sizes.lg,
    color: colors.navy,
  },
  pricePeriod: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.xs,
    color: colors.gray,
    marginLeft: 2,
  },
});
