import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { PropertyCard } from '@/components/property/PropertyCard';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { fetchUserFavoriteIds, fetchPublishedProperties, toggleFavoriteProperty } from '@/services/propertyService';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/layout';

export default function FavoritosScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: favoriteIds = [], isLoading: loadingFavs } = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: () => (user ? fetchUserFavoriteIds(user.id) : Promise.resolve([])),
    enabled: !!user,
  });

  const { data: allProperties = [], isLoading: loadingProps } = useQuery({
    queryKey: ['allPublishedProperties'],
    queryFn: () => fetchPublishedProperties({ pageSize: 50 }),
  });

  const favoriteProperties = allProperties.filter((p) => favoriteIds.includes(p.id));

  async function handleRemoveFavorite(propertyId: string) {
    if (!user) return;
    await toggleFavoriteProperty(user.id, propertyId);
    queryClient.invalidateQueries({ queryKey: ['favorites', user.id] });
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Meus Favoritos" />
        <EmptyState
          icon="heart-outline"
          title="Faça login para salvar imóveis"
          subtitle="Crie uma conta ou entre para sincronizar seus imóveis favoritos em qualquer dispositivo."
          action={{
            label: 'Fazer Login',
            onPress: () => router.push('/(auth)/login'),
          }}
        />
      </SafeAreaView>
    );
  }

  const isLoading = loadingFavs || loadingProps;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Meus Favoritos" />

      {isLoading ? (
        <View style={styles.listPadding}>
          <SkeletonCard height={240} />
          <SkeletonCard height={240} />
        </View>
      ) : (
        <FlatList
          data={favoriteProperties}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listPadding}
          renderItem={({ item }) => (
            <PropertyCard
              property={item}
              onPress={() => router.push(`/imovel/${item.id}`)}
              onFavoriteToggle={() => handleRemoveFavorite(item.id)}
              isFavorite={true}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="heart-off-outline"
              title="Nenhum favorito salvo"
              subtitle="Você ainda não favoritou nenhum imóvel. Explore nosso catálogo e clique no coração para guardar seus favoritos!"
              action={{
                label: 'Explorar Imóveis',
                onPress: () => router.push('/(tabs)'),
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
  listPadding: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
