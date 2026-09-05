import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Linking,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { WebView } from 'react-native-webview';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { safeImpactAsync } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';
import { fetchPropertyById, fetchNearbyAndSimilarProperties } from '@/services/propertyService';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { PropertyCard } from '@/components/property/PropertyCard';
import { BookingWidget } from '@/components/property/BookingWidget';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import { PropertyCardItem } from '@/types/app';
import { RentalInterestStatus } from '@/types/database';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, radius } from '@/constants/layout';
import { formatPrice } from '@/utils/format';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=800&auto=format&fit=crop';

const INTEREST_STATUS_LABEL: Partial<Record<RentalInterestStatus, string>> = {
  pendente: 'Em análise',
  em_analise: 'Em análise',
  aguardando_proprietario: 'Aguardando decisão do proprietário',
  auto_aprovado: 'Aprovada automaticamente',
  aprovado: 'Aprovada',
};

const AMENITY_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  'Piscina': 'pool',
  'Academia': 'dumbbell',
  'Churrasqueira': 'grill',
  'Salão de Festas': 'party-popper',
  'Playground': 'slide',
  'Portaria 24h': 'shield-account-outline',
  'Elevador': 'elevator',
  'Ar Condicionado': 'air-conditioner',
  'Armários na Cozinha': 'cupboard-outline',
  'Armários no Quarto': 'wardrobe-outline',
  'Varanda': 'window-open-variant',
  'Área de Serviço': 'washing-machine',
};

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [property, setProperty] = useState<PropertyCardItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [existingInterest, setExistingInterest] = useState<{ status: RentalInterestStatus } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [widgetBottomY, setWidgetBottomY] = useState(0);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [nearby, setNearby] = useState<PropertyCardItem[]>([]);
  const [similar, setSimilar] = useState<PropertyCardItem[]>([]);

  useEffect(() => {
    if (id) loadProperty();
  }, [id]);

  useEffect(() => {
    if (id && user) checkExistingInterest();
  }, [id, user]);

  async function loadProperty() {
    setLoading(true);
    const data = await fetchPropertyById(id);
    setProperty(data);
    setLoading(false);

    if (data && data.rental_type === 'longa_duracao') {
      const { nearby: nearbyData, similar: similarData } = await fetchNearbyAndSimilarProperties(id, {
        address_neighborhood: data.address_neighborhood,
        address_city: data.address_city,
        property_type: data.property_type,
        rent_amount: data.rent_amount,
      });
      setNearby(nearbyData);
      setSimilar(similarData);
    }
  }

  async function handleShare() {
    safeImpactAsync(Haptics.ImpactFeedbackStyle.Light);
    const webUrl = process.env.EXPO_PUBLIC_WEB_URL;
    const link = webUrl ? `${webUrl}/imoveis/${id}` : property?.title || 'Confira este imóvel';
    try {
      await Share.share({ message: `${property?.title}\n${link}`, url: link });
    } catch {
      // usuário cancelou o compartilhamento — sem ação necessária
    }
  }

  async function checkExistingInterest() {
    const { data } = await supabase
      .from('rental_interests')
      .select('status')
      .eq('property_id', id)
      .eq('tenant_id', user!.id)
      .not('status', 'in', '("recusado","expirado","bloqueada_negociacao")')
      .maybeSingle();
    setExistingInterest(data as { status: RentalInterestStatus } | null);
  }

  if (loading) {
    return <LoadingSpinner fullScreen message="Carregando detalhes do imóvel..." />;
  }

  if (!property) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Imóvel não encontrado" showBack />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Este imóvel não está mais disponível.</Text>
          <Button label="Voltar à Busca" onPress={() => router.back()} style={{ marginTop: spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  const isStr = property.rental_type === 'curta_duracao';
  const photos =
    property.property_media && property.property_media.length > 0
      ? property.property_media.map((m) => m.url)
      : [property.cover_image_url || FALLBACK_IMAGE];

  const lat = property.latitude || -23.55052;
  const lng = property.longitude || -46.633308;

  // OpenStreetMap Leaflet HTML String
  const osmHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { width: 100%; height: 100vh; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: false, dragging: false, touchZoom: false }).setView([${lat}, ${lng}], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);
        L.circle([${lat}, ${lng}], {
          color: '#00B4D8',
          fillColor: '#00B4D8',
          fillOpacity: 0.3,
          radius: 300
        }).addTo(map);
      </script>
    </body>
    </html>
  `;

  function openNativeMaps() {
    safeImpactAsync(Haptics.ImpactFeedbackStyle.Light);
    const scheme = Platform.OS === 'ios' ? 'maps:0,0?q=' : 'geo:0,0?q=';
    const latLng = `${lat},${lng}`;
    const label = encodeURIComponent(property?.title || 'Imóvel');
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    if (url) Linking.openURL(url);
  }

  function handleCTA() {
    safeImpactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/proposta/${property?.id}`);
  }

  function handleBookStr(params: {
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    pets: boolean;
  }) {
    safeImpactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/reservar/[propertyId]',
      params: { propertyId: property!.id, ...params, pets: params.pets ? '1' : '0' },
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title={property.title} showBack />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={16}
        onScroll={(e) => {
          if (!isStr) return;
          setShowStickyBar(e.nativeEvent.contentOffset.y > widgetBottomY - 80);
        }}
      >
        {/* Galeria Horizontal de Fotos */}
        <View style={styles.galleryWrapper}>
          <FlatList
            data={photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const slide = Math.ceil(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              if (slide !== activePhotoIndex) setActivePhotoIndex(slide);
            }}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={styles.galleryImage} contentFit="cover" />
            )}
          />

          {/* Pagination Dots */}
          {photos.length > 1 && (
            <View style={styles.dotsContainer}>
              {photos.map((_, idx) => (
                <View
                  key={idx}
                  style={[styles.dot, idx === activePhotoIndex && styles.activeDot]}
                />
              ))}
            </View>
          )}

          <View style={styles.badgeOverlay}>
            <Badge
              label={isStr ? 'Temporada (STR)' : 'Longo Prazo (LTR)'}
              variant={isStr ? 'info' : 'success'}
            />
          </View>
        </View>

        {isStr && (
          <View style={styles.strTitleBlock}>
            <Text style={styles.titleText}>{property.title}</Text>
            <Text style={styles.addressText}>
              <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.cyan} />{' '}
              {property.address_neighborhood}, {property.address_city} / {property.address_state}
            </Text>
          </View>
        )}

        {isStr && (
          <View onLayout={(e) => setWidgetBottomY(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
            <BookingWidget
              propertyId={property.id}
              petsAllowed={!!property.pets_allowed}
              onBook={handleBookStr}
            />
          </View>
        )}

        {/* Título & Endereço */}
        <View style={styles.bodySection}>
          {!isStr && (
            <>
              <Text style={styles.priceTag}>{formatPrice(property.rent_amount)}</Text>
              <Text style={styles.pricePeriod}>por mês</Text>

              <Text style={styles.titleText}>{property.title}</Text>
              <Text style={styles.addressText}>
                <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.cyan} />{' '}
                {property.address_street}, {property.address_number} — {property.address_neighborhood},{' '}
                {property.address_city} / {property.address_state}
                {property.address_zip ? ` · CEP ${property.address_zip}` : ''}
              </Text>
            </>
          )}

          {/* Detalhamento de Valores (Condomínio / IPTU / Total) */}
          {!isStr && ((property.condo_fee ?? 0) > 0 || (property.iptu_amount ?? 0) > 0) && (
            <View style={styles.priceBreakdownCard}>
              {(property.condo_fee ?? 0) > 0 && (
                <View style={styles.priceBreakdownRow}>
                  <Text style={styles.priceBreakdownLabel}>Condomínio</Text>
                  <Text style={styles.priceBreakdownValue}>{formatPrice(property.condo_fee)}</Text>
                </View>
              )}
              {(property.iptu_amount ?? 0) > 0 && (
                <View style={styles.priceBreakdownRow}>
                  <Text style={styles.priceBreakdownLabel}>IPTU mensal</Text>
                  <Text style={styles.priceBreakdownValue}>{formatPrice(property.iptu_amount)}</Text>
                </View>
              )}
              <View style={[styles.priceBreakdownRow, styles.priceBreakdownTotalRow]}>
                <Text style={styles.priceBreakdownTotalLabel}>Total estimado</Text>
                <Text style={styles.priceBreakdownTotalValue}>
                  {formatPrice(
                    property.rent_amount + (property.condo_fee || 0) + (property.iptu_amount || 0)
                  )}
                </Text>
              </View>
            </View>
          )}

          {/* Grid de Especificações */}
          <View style={styles.specsContainer}>
            {!!property.area_total && (
              <View style={styles.specBox}>
                <MaterialCommunityIcons name="arrow-expand-all" size={24} color={colors.navy} />
                <Text style={styles.specVal}>{property.area_total}m²</Text>
                <Text style={styles.specLbl}>Área Total</Text>
              </View>
            )}
            <View style={styles.specBox}>
              <MaterialCommunityIcons name="bed-king-outline" size={24} color={colors.navy} />
              <Text style={styles.specVal}>{property.bedrooms}</Text>
              <Text style={styles.specLbl}>Quartos</Text>
            </View>
            <View style={styles.specBox}>
              <MaterialCommunityIcons name="shower" size={24} color={colors.navy} />
              <Text style={styles.specVal}>{property.bathrooms}</Text>
              <Text style={styles.specLbl}>Banheiros</Text>
            </View>
            <View style={styles.specBox}>
              <MaterialCommunityIcons name="arrow-all" size={24} color={colors.navy} />
              <Text style={styles.specVal}>{property.area_useful || 0}m²</Text>
              <Text style={styles.specLbl}>Área Útil</Text>
            </View>
            <View style={styles.specBox}>
              <MaterialCommunityIcons name="car-outline" size={24} color={colors.navy} />
              <Text style={styles.specVal}>{property.parking_spots || 0}</Text>
              <Text style={styles.specLbl}>Vagas</Text>
            </View>
            {property.furnished && (
              <View style={styles.specBox}>
                <MaterialCommunityIcons name="sofa-outline" size={24} color={colors.navy} />
                <Text style={styles.specVal}>Sim</Text>
                <Text style={styles.specLbl}>Mobiliado</Text>
              </View>
            )}
          </View>

          {/* Descrição */}
          {!!property.description && (
            <>
              <Text style={styles.sectionHeader}>Sobre o imóvel</Text>
              <Text style={styles.descriptionText}>{property.description}</Text>
            </>
          )}

          {/* Comodidades */}
          {!!property.amenities && property.amenities.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Comodidades</Text>
              <View style={styles.amenitiesGrid}>
                {property.amenities.map((amenity) => (
                  <View key={amenity} style={styles.amenityChip}>
                    <MaterialCommunityIcons
                      name={AMENITY_ICONS[amenity] || 'check-circle-outline'}
                      size={18}
                      color={colors.orange}
                    />
                    <Text style={styles.amenityChipText}>{amenity}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Aceita Pets */}
          {property.pets_allowed !== undefined && property.pets_allowed !== null && (
            <View
              style={[
                styles.petsWidget,
                property.pets_allowed ? styles.petsWidgetAllowed : styles.petsWidgetDenied,
              ]}
            >
              <MaterialCommunityIcons
                name="paw"
                size={20}
                color={property.pets_allowed ? colors.success : colors.gray}
              />
              <Text
                style={[
                  styles.petsWidgetText,
                  property.pets_allowed ? styles.petsWidgetTextAllowed : styles.petsWidgetTextDenied,
                ]}
              >
                {property.pets_allowed
                  ? 'Animais de estimação são bem-vindos! 🐾'
                  : 'Não é permitido animais de estimação.'}
              </Text>
            </View>
          )}

          {/* Localização / Mapa OpenStreetMap */}
          <Text style={styles.sectionHeader}>Localização Aproximada</Text>
          <View style={styles.mapContainer}>
            {Platform.OS === 'web'
              ? // react-native-webview não roda no browser (react-native-web não implementa
                // esse componente) — no web usamos um <iframe> real com o mesmo HTML/Leaflet.
                React.createElement('iframe', {
                  srcDoc: osmHtml,
                  style: { ...(styles.webViewMap as object), border: 0 },
                  title: 'Localização aproximada',
                })
              : <WebView source={{ html: osmHtml }} style={styles.webViewMap} scrollEnabled={false} />}
            <TouchableOpacity style={styles.openMapButton} onPress={openNativeMaps}>
              <MaterialCommunityIcons name="google-maps" size={18} color={colors.navy} />
              <Text style={styles.openMapText}>Abrir no app de Mapas</Text>
            </TouchableOpacity>
          </View>

          {/* Card de Segurança */}
          <View style={styles.trustCard}>
            <MaterialCommunityIcons name="shield-check-outline" size={22} color={colors.orange} />
            <View style={{ flex: 1 }}>
              <Text style={styles.trustCardTitle}>Locação 100% Segura</Text>
              <Text style={styles.trustCardSub}>
                Contratos digitais, pagamento online e suporte completo da Clicou Alugou durante toda a
                locação.
              </Text>
            </View>
          </View>

          {/* Compartilhar */}
          <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.8}>
            <MaterialCommunityIcons name="share-variant-outline" size={18} color={colors.gray} />
            <Text style={styles.shareButtonText}>Compartilhar anúncio</Text>
          </TouchableOpacity>
        </View>

        {/* Imóveis Próximos */}
        {nearby.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedSectionTitle}>Imóveis Próximos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedRow}>
              {nearby.map((item) => (
                <View key={item.id} style={styles.relatedCardWrapper}>
                  <PropertyCard property={item} onPress={() => router.push(`/imovel/${item.id}`)} />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Imóveis Similares */}
        {similar.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedSectionTitle}>Imóveis Similares</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedRow}>
              {similar.map((item) => (
                <View key={item.id} style={styles.relatedCardWrapper}>
                  <PropertyCard property={item} onPress={() => router.push(`/imovel/${item.id}`)} />
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Sticky Bottom Bar CTA — na temporada só aparece depois que o widget de reserva
          (que já tem preço + botão próprios) sai da tela, pra não duplicar a UI. */}
      {(!isStr || showStickyBar) && (
        <View style={styles.bottomBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bottomPriceLabel}>{isStr ? 'A partir de' : 'Valor mensal'}</Text>
            <Text style={styles.bottomPriceVal}>
              {formatPrice(isStr ? property.base_price : property.rent_amount)}
              {isStr && <Text style={styles.bottomPricePeriod}> / noite</Text>}
            </Text>
          </View>
          {isStr ? (
            <Button
              label="Reservar"
              onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
              size="lg"
              style={{ flex: 1.2 }}
            />
          ) : existingInterest ? (
            <View style={styles.appliedPanel}>
              <MaterialCommunityIcons name="check-circle" size={18} color={colors.success} />
              <Text style={styles.appliedPanelText} numberOfLines={2}>
                Proposta enviada! Status: {INTEREST_STATUS_LABEL[existingInterest.status] || existingInterest.status}
              </Text>
            </View>
          ) : (
            <Button label="Tenho Interesse" onPress={handleCTA} size="lg" style={{ flex: 1.2 }} />
          )}
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
  scrollContent: {
    paddingBottom: 100,
  },
  galleryWrapper: {
    width: SCREEN_WIDTH,
    height: 260,
    position: 'relative',
    backgroundColor: colors.bg.skeleton,
  },
  galleryImage: {
    width: SCREEN_WIDTH,
    height: 260,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  activeDot: {
    backgroundColor: colors.cyan,
    width: 16,
  },
  badgeOverlay: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
  },
  bodySection: {
    padding: spacing.lg,
  },
  strTitleBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  priceTag: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.cyan,
  },
  pricePeriod: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
    marginBottom: spacing.md,
  },
  titleText: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.navy,
    marginBottom: spacing.xs,
  },
  addressText: {
    fontSize: typography.sizes.sm,
    color: colors.gray,
    marginBottom: spacing.lg,
  },
  specsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.xl,
    justifyContent: 'space-around',
  },
  specBox: {
    alignItems: 'center',
  },
  specVal: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.navy,
    marginTop: spacing.xs,
  },
  specLbl: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
  },
  sectionHeader: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.navy,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  descriptionText: {
    fontSize: typography.sizes.base,
    color: colors.black,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  mapContainer: {
    height: 200,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.default,
    position: 'relative',
  },
  webViewMap: {
    flex: 1,
  },
  openMapButton: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  openMapText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.navy,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: typography.sizes.base,
    color: colors.gray,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  bottomPriceLabel: {
    fontSize: typography.sizes.xs,
    color: colors.gray,
  },
  bottomPriceVal: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.navy,
  },
  bottomPricePeriod: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.regular,
    color: colors.gray,
  },
  appliedPanel: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#f0faf2',
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  appliedPanelText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.success,
  },
  priceBreakdownCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  priceBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceBreakdownLabel: {
    fontSize: typography.sizes.sm,
    color: colors.gray,
  },
  priceBreakdownValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.black,
  },
  priceBreakdownTotalRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  priceBreakdownTotalLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.navy,
  },
  priceBreakdownTotalValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.orange,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    width: '47%',
  },
  amenityChipText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.black,
  },
  petsWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  petsWidgetAllowed: {
    backgroundColor: '#f0faf2',
    borderColor: '#bbf0c8',
  },
  petsWidgetDenied: {
    backgroundColor: colors.bg.input,
    borderColor: colors.border.default,
  },
  petsWidgetText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  petsWidgetTextAllowed: {
    color: colors.success,
  },
  petsWidgetTextDenied: {
    color: colors.gray,
  },
  trustCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 75, 38, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 38, 0.15)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  trustCardTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.black,
    marginBottom: 2,
  },
  trustCardSub: {
    fontSize: typography.sizes.xs - 1,
    color: colors.gray,
    lineHeight: 15,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.md,
  },
  shareButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.gray,
  },
  relatedSection: {
    marginTop: spacing.xl,
    paddingLeft: spacing.lg,
  },
  relatedSectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.navy,
    marginBottom: spacing.md,
  },
  relatedRow: {
    paddingRight: spacing.lg,
    gap: spacing.md,
  },
  relatedCardWrapper: {
    width: 220,
  },
});
