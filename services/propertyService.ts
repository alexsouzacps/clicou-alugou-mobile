import { supabase } from './supabase';
import { PropertyCardItem } from '@/types/app';
import { RentalType, PropertyType } from '@/types/database';

export interface FetchPropertiesParams {
  rentalType?: RentalType;
  propertyType?: PropertyType | 'todos';
  city?: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  bedrooms?: number | null;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}

/**
 * base_price/cleaning_fee/max_guests de temporada NÃO existem na tabela `properties`
 * — moram em `str_pricing` (1:1 por imóvel). Pra listagem usamos a mesma RPC que o
 * site usa (`search_published_str_properties`), que já faz esse join no banco.
 */
async function fetchPublishedStrProperties(params: FetchPropertiesParams): Promise<PropertyCardItem[]> {
  const { propertyType = 'todos', city, maxPrice, page = 0, pageSize = 20, searchQuery } = params;

  const { data, error } = await supabase.rpc('search_published_str_properties', {
    p_search_query: searchQuery?.trim() || city?.trim() || '',
    p_property_type: propertyType,
    p_checkin: null,
    p_checkout: null,
    p_guests: null,
    p_max_price: maxPrice && maxPrice > 0 ? maxPrice : null,
    p_sort_by: 'relevancia',
    p_limit: pageSize,
    p_offset: page * pageSize,
    p_pets: false,
  });

  if (error) {
    console.error('[propertyService] Erro ao buscar hospedagens:', error);
    throw new Error(error.message);
  }

  return (data || []).map((row: any) => ({
    ...row,
    rental_type: 'curta_duracao',
    area_useful: row.area_total,
    amenities: row.amenities,
    property_media: [],
  }));
}

export async function fetchPublishedProperties(params: FetchPropertiesParams = {}): Promise<PropertyCardItem[]> {
  const {
    rentalType = 'longa_duracao',
    propertyType = 'todos',
    city,
    minPrice,
    maxPrice,
    bedrooms,
    searchQuery,
    page = 0,
    pageSize = 20,
  } = params;

  if (rentalType === 'curta_duracao') {
    return fetchPublishedStrProperties(params);
  }

  let query = supabase
    .from('properties')
    .select('*, property_media(url, is_cover)')
    .eq('status', 'publicado')
    .eq('rental_type', rentalType);

  if (propertyType && propertyType !== 'todos') {
    query = query.eq('property_type', propertyType);
  }

  if (city && city.trim() !== '') {
    query = query.ilike('address_city', `%${city.trim()}%`);
  }

  if (minPrice != null && minPrice > 0) {
    query = query.gte('rent_amount', minPrice);
  }

  if (maxPrice != null && maxPrice > 0) {
    query = query.lte('rent_amount', maxPrice);
  }

  if (bedrooms != null && bedrooms > 0) {
    query = query.gte('bedrooms', bedrooms);
  }

  if (searchQuery && searchQuery.trim() !== '') {
    const term = `%${searchQuery.trim()}%`;
    query = query.or(`title.ilike.${term},address_neighborhood.ilike.${term},address_city.ilike.${term}`);
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await query.order('created_at', { ascending: false }).range(from, to);

  if (error) {
    console.error('[propertyService] Erro ao buscar imóveis:', error);
    throw new Error(error.message);
  }

  return (data || []).map((prop: any) => ({
    ...prop,
    cover_image_url:
      prop.property_media?.find((m: any) => m.is_cover)?.url ||
      prop.property_media?.[0]?.url ||
      '',
  }));
}

export async function fetchPropertyById(id: string): Promise<PropertyCardItem | null> {
  const { data, error } = await supabase
    .from('properties')
    .select('*, property_media(url, is_cover), owner:profiles!properties_owner_id_fkey(id, full_name, avatar_url, phone, created_at)')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[propertyService] Erro ao buscar imóvel por ID:', error);
    return null;
  }

  let strPricing: { base_price: number; cleaning_fee: number; max_guests: number } | null = null;
  if (data.rental_type === 'curta_duracao') {
    const { data: pricing } = await supabase
      .from('str_pricing')
      .select('base_price, cleaning_fee, max_guests')
      .eq('property_id', id)
      .single();
    strPricing = pricing;
  }

  return {
    ...data,
    ...(strPricing || {}),
    cover_image_url:
      data.property_media?.find((m: any) => m.is_cover)?.url ||
      data.property_media?.[0]?.url ||
      '',
  };
}

/** Mesma lógica de "Imóveis Próximos" / "Imóveis Similares" do site. */
export async function fetchNearbyAndSimilarProperties(
  propertyId: string,
  property: { address_neighborhood: string; address_city: string; property_type: string; rent_amount: number }
): Promise<{ nearby: PropertyCardItem[]; similar: PropertyCardItem[] }> {
  const priceMin = Math.round(property.rent_amount * 0.7);
  const priceMax = Math.round(property.rent_amount * 1.3);

  const mapMedia = (rows: any[]) =>
    rows.map((prop) => ({
      ...prop,
      cover_image_url: prop.property_media?.[0]?.url || '',
    }));

  let { data: nearbyRaw } = await supabase
    .from('properties')
    .select('*, property_media(url)')
    .eq('status', 'publicado')
    .eq('address_neighborhood', property.address_neighborhood)
    .gte('rent_amount', priceMin)
    .lte('rent_amount', priceMax)
    .neq('id', propertyId)
    .order('rent_amount', { ascending: true })
    .limit(4);

  if (!nearbyRaw || nearbyRaw.length === 0) {
    const { data: fallback } = await supabase
      .from('properties')
      .select('*, property_media(url)')
      .eq('status', 'publicado')
      .eq('address_city', property.address_city)
      .eq('property_type', property.property_type)
      .gte('rent_amount', priceMin)
      .lte('rent_amount', priceMax)
      .neq('id', propertyId)
      .order('rent_amount', { ascending: true })
      .limit(4);
    nearbyRaw = fallback;
  }

  const { data: similarRaw } = await supabase
    .from('properties')
    .select('*, property_media(url)')
    .eq('status', 'publicado')
    .eq('address_city', property.address_city)
    .eq('property_type', property.property_type)
    .gte('rent_amount', priceMin)
    .lte('rent_amount', priceMax)
    .neq('id', propertyId)
    .order('created_at', { ascending: false })
    .limit(4);

  return {
    nearby: mapMedia(nearbyRaw || []),
    similar: mapMedia(similarRaw || []),
  };
}

export async function toggleFavoriteProperty(userId: string, propertyId: string): Promise<boolean> {
  // Verifica se já é favorito
  const { data } = await supabase
    .from('property_favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('property_id', propertyId)
    .single();

  if (data) {
    // Remove
    await supabase
      .from('property_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('property_id', propertyId);
    return false;
  } else {
    // Insere
    await supabase
      .from('property_favorites')
      .insert({ user_id: userId, property_id: propertyId });
    return true;
  }
}

export async function fetchUserFavoriteIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('property_favorites')
    .select('property_id')
    .eq('user_id', userId);

  if (error || !data) return [];
  return data.map((f) => f.property_id);
}
