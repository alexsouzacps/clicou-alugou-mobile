import { supabase } from './supabase';
import { StrPricingRow } from '@/types/database';

export interface StrPriceBreakdown {
  pricing: StrPricingRow;
  nights: number;
  subtotalNights: number;
  cleaningFee: number;
  dailyCleaningTotal: number;
  total: number;
}

export async function fetchStrPricing(propertyId: string): Promise<StrPricingRow | null> {
  const { data, error } = await supabase
    .from('str_pricing')
    .select('*')
    .eq('property_id', propertyId)
    .single();

  if (error) {
    console.error('[strService] Erro ao buscar precificação STR:', error);
    return null;
  }
  return data as StrPricingRow;
}

/** Datas indisponíveis (qualquer status diferente de 'disponivel'), como 'YYYY-MM-DD'. */
export async function fetchStrBlockedDates(propertyId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('str_availability')
    .select('date')
    .eq('property_id', propertyId)
    .neq('status', 'disponivel');

  if (error || !data) return [];
  return data.map((row) => row.date as string);
}

/** Overrides de preço por data (str_price_calendar), indexados por 'YYYY-MM-DD'. */
export async function fetchStrPriceOverrides(
  propertyId: string,
  from: string,
  to: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('str_price_calendar')
    .select('date, price')
    .eq('property_id', propertyId)
    .gte('date', from)
    .lt('date', to);

  if (error || !data) return {};
  return Object.fromEntries(data.map((row) => [row.date as string, row.price as number]));
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Lista cada noite (não a data de check-out) entre check-in e check-out. */
export function eachNight(checkIn: Date, checkOut: Date): string[] {
  const nights: string[] = [];
  const cursor = new Date(checkIn);
  while (cursor < checkOut) {
    nights.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return nights;
}

export function calculateStrPrice(
  pricing: StrPricingRow,
  checkIn: Date,
  checkOut: Date,
  priceOverrides: Record<string, number>
): StrPriceBreakdown {
  const nights = eachNight(checkIn, checkOut);
  const subtotalNights = nights.reduce(
    (sum, night) => sum + (priceOverrides[night] ?? pricing.base_price),
    0
  );
  const dailyCleaningTotal = (pricing.cleaning_fee_per_night || 0) * nights.length;
  const cleaningFee = pricing.cleaning_fee || 0;

  return {
    pricing,
    nights: nights.length,
    subtotalNights,
    cleaningFee,
    dailyCleaningTotal,
    total: subtotalNights + cleaningFee + dailyCleaningTotal,
  };
}

export type StrPaymentMethodInput = 'pix' | 'credit_card' | 'boleto';

export interface StrCheckoutParams {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  pets: boolean;
  paymentMethod: StrPaymentMethodInput;
}

export interface StrCheckoutResult {
  reservationId: string;
  invoiceUrl?: string;
  qrCode?: string;
  copyPaste?: string;
  expiration?: string;
  qrCodePending?: boolean;
  paymentId?: string;
  bankSlipUrl?: string;
  barCode?: string | null;
  identificationField?: string | null;
  error?: string;
}

/**
 * Cria a reserva + cobrança chamando a mesma rota de pagamento que o site usa
 * (`/api/payments/checkout-str`). Essa rota roda no backend do site (chave do
 * Asaas fica só lá) — o app se autentica passando o token de sessão do Supabase
 * no header Authorization, que a rota já foi ajustada para aceitar.
 */
export async function checkoutStrReservation(params: StrCheckoutParams): Promise<StrCheckoutResult> {
  const webUrl = process.env.EXPO_PUBLIC_WEB_URL;
  if (!webUrl) {
    return { reservationId: '', error: 'URL do site não configurada (EXPO_PUBLIC_WEB_URL).' };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { reservationId: '', error: 'Sessão expirada. Faça login novamente.' };
  }

  try {
    const res = await fetch(`${webUrl}/api/payments/checkout-str`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        propertyId: params.propertyId,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        adults: params.adults,
        children: params.children,
        pets: params.pets,
        paymentMethod: params.paymentMethod,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { reservationId: '', error: data.error || 'Falha ao criar reserva.' };
    }
    return data as StrCheckoutResult;
  } catch (err) {
    return { reservationId: '', error: 'Falha de conexão ao processar a reserva.' };
  }
}
