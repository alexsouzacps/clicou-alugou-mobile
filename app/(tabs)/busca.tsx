import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { PropertyCard } from '@/components/property/PropertyCard';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { useFiltersStore } from '@/store/filtersStore';
import { useAuth } from '@/hooks/useAuth';
import { fetchPublishedProperties, toggleFavoriteProperty, fetchUserFavoriteIds } from '@/services/propertyService';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, radius } from '@/constants/layout';
import { PropertyType } from '@/types/database';

const PROPERTY_TYPES: { label: string; value: PropertyType | 'todos' }[] = [
  { label: 'Todos', value: 'todos' },
  { label: 'Apartamento', value: 'apartamento' },
  { label: 'Casa', value: 'casa' },
  { label: 'Studio/Kitnet', value: 'kitnet' },
  { label: 'Comercial', value: 'comercial' },
];

export default function BuscaScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    rentalType,
    searchQuery,
    propertyType,
    bedrooms,
    pets,
    setRentalType,
    setSearchQuery,
    setPropertyType,
    setBedrooms,
    setPets,
    reset,
  } = useFiltersStore();

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['searchProperties', rentalType, propertyType, searchQuery, bedrooms, pets],
    queryFn: () =>
      fetchPublishedProperties({
        rentalType,
        propertyType,
        searchQuery,
        bedrooms,
      }),
  });

  const { data: favoriteIds = [] } = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: () => (user ? fetchUserFavoriteIds(user.id) : Promise.resolve([])),
    enabled: !!user,
  });

  async function handleFavoriteToggle(propertyId: string) {
    if (!user) {
      router.push('/(auth)/login');
      return;
    }
    await toggleFavoriteProperty(user.id, propertyId);
    queryClient.invalidateQueries({ queryKey: ['favorites', user.id] });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Busca Avançada" />

      <View style={styles.filterSection}>
        {/* Barra de Busca */}
        <Input
          placeholder="Buscar por cidade, bairro ou título..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon="magnify"
          rightIcon={searchQuery ? 'close-circle' : undefined}
          onRightIconPress={() => setSearchQuery('')}
          containerStyle={styles.searchInput}
        />

        {/* Seletor de Tipo (Alugar vs Temporada) */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentButton, rentalType === 'longa_duracao' && styles.segmentButtonActive]}
            onPress={() => setRentalType('longa_duracao')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="home-city-outline"
              size={16}
              color={rentalType === 'longa_duracao' ? colors.white : colors.gray}
            />
            <Text style={[styles.segmentText, rentalType === 'longa_duracao' && styles.segmentTextActive]}>
              Aluguel Mensal
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentButton, rentalType === 'curta_duracao' && styles.segmentButtonActive]}
            onPress={() => setRentalType('curta_duracao')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="umbrella-beach-outline"
              size={16}
              color={rentalType === 'curta_duracao' ? colors.white : colors.gray}
            />
            <Text style={[styles.segmentText, rentalType === 'curta_duracao' && styles.segmentTextActive]}>
              Temporada
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tipos de Imóvel Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {PROPERTY_TYPES.map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[
                styles.chip,
                propertyType === item.value && styles.chipActive,
              ]}
              onPress={() => setPropertyType(item.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  propertyType === item.value && styles.chipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Filtros rápidos: Quartos */}
        <View style={styles.quickFilterRow}>
          <Text style={styles.filterLabel}>Quartos:</Text>
          <View style={styles.bedroomSelector}>
            {[null, 1, 2, 3, 4].map((num) => (
              <TouchableOpacity
                key={num === null ? 'any' : num}
                style={[
                  styles.bedroomChip,
                  bedrooms === num && styles.bedroomChipActive,
                ]}
                onPress={() => setBedrooms(num)}
              >
                <Text
                  style={[
                    styles.bedroomText,
                    bedrooms === num && styles.bedroomTextActive,
                  ]}
                >
                  {num === null ? 'Qualquer' : `${num}+`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Resultados da Busca */}
      {isLoading ? (
        <View style={styles.listPadding}>
          <SkeletonCard height={240} />
          <SkeletonCard height={240} />
        </View>
      ) : (
        <FlatList
          data={properties}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listPadding}
          renderItem={({ item }) => (
            <PropertyCard
              property={item}
              onPress={() => router.push(`/imovel/${item.id}`)}
              onFavoriteToggle={() => handleFavoriteToggle(item.id)}
              isFavorite={favoriteIds.includes(item.id)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="magnify-remove-outline"
              title="Nenhum imóvel encontrado"
              subtitle="Tente ajustar seus termos de busca ou filtros para encontrar opções de imóveis."
              action={{
                label: 'Limpar Filtros',
                onPress: reset,
              }}
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
  filterSection: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  searchInput: {
    marginBottom: spacing.sm,
  },
  segmentContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bg.input,
    gap: spacing.xs,
  },
  segmentButtonActive: {
    backgroundColor: colors.navy,
  },
  segmentText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.gray,
  },
  segmentTextActive: {
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  chipsScroll: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    backgroundColor: colors.bg.input,
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.cyan,
  },
  chipText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.gray,
  },
  chipTextActive: {
    color: colors.white,
    fontWeight: typography.weights.bold,
  },
  quickFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.gray,
  },
  bedroomSelector: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  bedroomChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.input,
  },
  bedroomChipActive: {
    backgroundColor: colors.navy,
  },
  bedroomText: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
  },
  bedroomTextActive: {
    color: colors.white,
    fontWeight: typography.weights.bold,
  },
  listPadding: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
