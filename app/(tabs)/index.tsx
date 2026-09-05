import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CopilotProvider, CopilotStep, walkthroughable, useCopilot } from 'react-native-copilot';
import { useAuth } from '@/hooks/useAuth';
import { useFiltersStore } from '@/store/filtersStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { PropertyCard } from '@/components/property/PropertyCard';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { fetchPublishedProperties, toggleFavoriteProperty, fetchUserFavoriteIds } from '@/services/propertyService';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, radius, shadow } from '@/constants/layout';
import { RentalType } from '@/types/database';

const WalkthroughableView = walkthroughable(View);
const WalkthroughableTouchable = walkthroughable(TouchableOpacity);

const copilotLabels = {
  previous: 'Anterior',
  next: 'Próximo',
  skip: 'Pular',
  finish: 'Concluir',
};

export default function HomeScreen() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduceMotion).catch(() => {});
  }, []);

  return (
    <CopilotProvider
      // "view" (retângulos animados) em vez de "svg": o overlay em SVG usa um path
      // `d` animado que quebra no react-native-web ("CSSStyleDeclaration" indexed
      // property error) — "view" funciona igual em nativo e web.
      overlay="view"
      animated={!reduceMotion}
      labels={copilotLabels}
      backdropColor="rgba(1, 34, 71, 0.75)"
      arrowColor={colors.white}
      stopOnOutsideClick
    >
      <HomeScreenContent />
    </CopilotProvider>
  );
}

function HomeScreenContent() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const filtersStore = useFiltersStore();
  const queryClient = useQueryClient();

  const [rentalType, setRentalType] = useState<RentalType>(filtersStore.rentalType || 'longa_duracao');
  const [refreshing, setRefreshing] = useState(false);

  const { start, copilotEvents } = useCopilot();
  const hasSeenTour = useOnboardingStore((s) => s.hasSeenTour);
  const setHasSeenTour = useOnboardingStore((s) => s.setHasSeenTour);

  // Query de Imóveis com os filtros do Zustand
  const {
    data: properties = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['properties', rentalType, filtersStore.city, filtersStore.propertyType],
    queryFn: () =>
      fetchPublishedProperties({
        rentalType,
        city: filtersStore.city || undefined,
        propertyType: filtersStore.propertyType !== 'todos' ? filtersStore.propertyType : undefined,
      }),
  });

  // Query de Favoritos
  const { data: favoriteIds = [] } = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: () => (user ? fetchUserFavoriteIds(user.id) : Promise.resolve([])),
    enabled: !!user,
  });

  // Marca o tour como visto tanto ao concluir quanto ao pular (copilot dispara 'stop' nos dois casos).
  useEffect(() => {
    const markSeen = () => setHasSeenTour(true);
    copilotEvents.on('stop', markSeen);
    return () => {
      copilotEvents.off('stop', markSeen);
    };
  }, [copilotEvents, setHasSeenTour]);

  // `start` muda de referência a cada passo do tour (copilot recria o contexto).
  // Guardamos a versão mais atual numa ref pra poder chamá-la sem colocar `start`
  // nas deps do efeito abaixo — senão cada "Próximo" reagendava um novo start()
  // e reiniciava o tour do passo 1.
  const startRef = React.useRef(start);
  startRef.current = start;

  // Evita disparar o tour de novo a cada re-render enquanto ele está em andamento;
  // reseta quando `hasSeenTour` volta a ficar falso (ex: botão "Ver tour novamente").
  const tourStartedRef = React.useRef(false);

  // Só dispara o tour depois que os imóveis carregaram, pra não apontar seta pro skeleton.
  useEffect(() => {
    if (hasSeenTour) {
      tourStartedRef.current = false;
      return;
    }
    if (isLoading || tourStartedRef.current) return;
    tourStartedRef.current = true;
    const timer = setTimeout(() => startRef.current(), 500);
    return () => clearTimeout(timer);
  }, [isLoading, hasSeenTour]);

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  async function handleFavoriteToggle(propertyId: string) {
    if (!user) {
      router.push('/(auth)/login');
      return;
    }
    await toggleFavoriteProperty(user.id, propertyId);
    queryClient.invalidateQueries({ queryKey: ['favorites', user.id] });
  }

  const firstName = profile?.full_name ? profile.full_name.split(' ')[0] : 'Visitante';
  const locationLabel = filtersStore.city ? filtersStore.city : 'Qualquer localização';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Superior da Marca */}
      <View style={styles.headerContainer}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/images/icon-clicou-alugou.png')}
            style={styles.brandIcon}
            contentFit="contain"
          />
          <View>
            <Text style={styles.greetingText}>Olá, {firstName}! 👋</Text>
            <Text style={styles.subGreeting}>Encontre o seu imóvel ideal</Text>
          </View>
        </View>

        <CopilotStep
          name="notifications"
          order={3}
          text="Acompanhe aqui novidades de propostas, mensagens e visitas."
        >
          <WalkthroughableTouchable
            style={styles.bellButton}
            onPress={() => router.push('/(tabs)/dashboard')}
          >
            <MaterialCommunityIcons name="bell-outline" size={22} color={colors.navy} />
          </WalkthroughableTouchable>
        </CopilotStep>
      </View>

      {/* Cápsula de Busca Estilo QuintoAndar */}
      <CopilotStep
        name="search"
        order={1}
        text="Toque aqui para buscar por localização e ajustar filtros de tipo, preço e quartos."
      >
        <WalkthroughableTouchable
          style={styles.searchCapsule}
          onPress={() => router.push('/(tabs)/busca')}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="map-marker-outline" size={20} color={colors.blue} />
          <View style={styles.searchCapsuleTextCol}>
            <Text style={styles.searchCapsuleTitle} numberOfLines={1}>
              {locationLabel}
            </Text>
            <Text style={styles.searchCapsuleSub}>
              {rentalType === 'longa_duracao' ? 'Aluguel Mensal' : 'Temporada'} • Toque para filtrar
            </Text>
          </View>
          <View style={styles.filterIconButton}>
            <MaterialCommunityIcons name="tune-variant" size={18} color={colors.navy} />
          </View>
        </WalkthroughableTouchable>
      </CopilotStep>

      {/* Seletor de Tipo (Alugar vs Temporada) */}
      <CopilotStep
        name="rentalType"
        order={2}
        text="Alterne entre aluguel mensal e temporada para ver imóveis diferentes."
      >
        <WalkthroughableView style={styles.segmentContainer}>
        <TouchableOpacity
          style={[
            styles.segmentButton,
            rentalType === 'longa_duracao' && styles.segmentButtonActive,
          ]}
          onPress={() => setRentalType('longa_duracao')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="home-city-outline"
            size={18}
            color={rentalType === 'longa_duracao' ? colors.white : colors.gray}
          />
          <Text
            style={[
              styles.segmentText,
              rentalType === 'longa_duracao' && styles.segmentTextActive,
            ]}
          >
            Aluguel Mensal
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentButton,
            rentalType === 'curta_duracao' && styles.segmentButtonActive,
          ]}
          onPress={() => setRentalType('curta_duracao')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="umbrella-beach-outline"
            size={18}
            color={rentalType === 'curta_duracao' ? colors.white : colors.gray}
          />
          <Text
            style={[
              styles.segmentText,
              rentalType === 'curta_duracao' && styles.segmentTextActive,
            ]}
          >
            Temporada
          </Text>
        </TouchableOpacity>
        </WalkthroughableView>
      </CopilotStep>

      {/* Contador de Resultados */}
      <CopilotStep
        name="results"
        order={4}
        text="Aqui você vê quantos imóveis encontramos para a sua busca."
      >
        <WalkthroughableView style={styles.resultsInfoRow}>
          <Text style={styles.resultsCountText}>
            {properties.length} {properties.length === 1 ? 'imóvel disponível' : 'imóveis disponíveis'}
          </Text>
        </WalkthroughableView>
      </CopilotStep>

      {/* Listagem de Imóveis */}
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.blue}
            />
          }
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
              icon="home-search-outline"
              title="Nenhum imóvel encontrado"
              description="Tente alterar sua busca ou limpar os filtros de localização."
              buttonLabel="Explorar busca"
              onButtonPress={() => router.push('/(tabs)/busca')}
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.white,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandIcon: {
    width: 36,
    height: 36,
  },
  greetingText: {
    fontFamily: typography.fonts.bold,
    fontSize: typography.sizes.base,
    color: colors.navy,
  },
  subGreeting: {
    fontFamily: typography.fonts.medium,
    fontSize: typography.sizes.xs,
    color: colors.gray,
  },
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Cápsula de Busca
  searchCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadow.sm,
  },
  searchCapsuleTextCol: {
    flex: 1,
    marginLeft: spacing.xs,
  },
  searchCapsuleTitle: {
    fontFamily: typography.fonts.bold,
    fontSize: typography.sizes.xs + 1,
    color: colors.navy,
  },
  searchCapsuleSub: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.xs - 1,
    color: colors.gray,
  },
  filterIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Seletor de Tipo
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
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
    fontFamily: typography.fonts.medium,
    fontSize: typography.sizes.xs,
    color: colors.gray,
  },
  segmentTextActive: {
    fontFamily: typography.fonts.bold,
    color: colors.white,
  },
  resultsInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  resultsCountText: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.xs + 1,
    color: colors.gray,
  },
  listPadding: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
