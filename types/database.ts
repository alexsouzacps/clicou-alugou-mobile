export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ProfileRole = 'proprietario' | 'locatario' | 'admin'

export type PropertyType = 'casa' | 'apartamento' | 'kitnet' | 'comercial' | 'loja'

export type PropertyStatus =
  | 'rascunho'
  | 'em_revisao'
  | 'aguarda_documentos'
  | 'publicado'
  | 'em_negociacao'
  | 'ocupado'
  | 'rejeitado'
  | 'arquivado'
  | 'solicita_correcao'

export type RentalInterestStatus =
  | 'pendente'
  | 'em_analise'
  | 'aprovado'
  | 'recusado'
  | 'expirado'
  | 'bloqueada_negociacao'
  | 'auto_aprovado'
  | 'aguardando_proprietario'

export type ContractStatus =
  | 'rascunho'
  | 'aguardando_aceite'
  | 'ativo'
  | 'encerrado'
  | 'cancelado'
  | 'rescindido'
  | 'suspenso'

export type PaymentStatus = 'pendente' | 'pago' | 'falha' | 'estornado'
export type PaymentMethod = 'boleto' | 'pix' | 'cartao'
export type PetsPolicy = 'nao_aceita' | 'aceita' | 'aceita_com_restricoes'

export type RentalType = 'longa_duracao' | 'curta_duracao'
export type StrReservationStatus =
  | 'pendente_pagamento'
  | 'confirmada'
  | 'ativa'
  | 'concluida'
  | 'cancelada'
  | 'expirada'
  | 'reembolsada'

export type StrAvailabilityStatus = 'disponivel' | 'reservado_pendente' | 'reservado' | 'bloqueado'
export type StrPaymentStatus = 'pendente' | 'pago' | 'falha' | 'estornado'
export type StrPaymentMethod = 'pix' | 'boleto' | 'cartao_credito' | 'cartao_debito'
export type StrCancellationPolicy = 'flexivel' | 'moderada' | 'rigorosa'
export type StrCheckinConfig = 'owner_only' | 'both'
export type StrCancelledBy = 'tenant' | 'owner' | 'admin'

export interface ProfileRow {
  id: string
  role: ProfileRole
  full_name: string
  email: string
  phone: string | null
  cpf_cnpj: string | null
  avatar_url: string | null
  document_verified: boolean
  address: Json | null
  birth_date: string | null
  created_at: string
  updated_at: string
}

export interface PropertyRow {
  id: string
  owner_id: string
  title: string
  description: string | null
  property_type: PropertyType
  rental_type: RentalType
  status: PropertyStatus
  address_street: string
  address_number: string
  address_complement: string | null
  address_neighborhood: string
  address_city: string
  address_state: string
  address_zip: string
  latitude: number | null
  longitude: number | null
  rent_amount: number
  condo_fee: number | null
  iptu_amount: number | null
  base_price: number | null
  cleaning_fee: number | null
  bedrooms: number
  bathrooms: number
  parking_spots: number
  area_useful: number
  area_total: number | null
  furnished: boolean
  pets_policy: PetsPolicy
  pets_allowed: boolean
  amenities: string[] | null
  cover_image_url: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export interface PropertyMediaRow {
  id: string
  property_id: string
  url: string
  is_cover: boolean
  display_order: number
  created_at: string
}

export interface RentalInterestRow {
  id: string
  property_id: string
  tenant_id: string
  status: RentalInterestStatus
  proposed_move_in: string | null
  monthly_income: number | null
  tenant_proposed_rent: number | null
  message: string | null
  rejection_reason: string | null
  reviewed_by: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
  reviewed_at: string | null
}

export interface ContractRow {
  id: string
  property_id: string
  tenant_id: string
  owner_id: string
  status: ContractStatus
  start_date: string
  end_date: string
  duration_months: number
  rent_amount: number
  condo_fee: number | null
  iptu_amount: number | null
  due_day: number
  created_at: string
  updated_at: string
}

export interface StrReservationRow {
  id: string
  property_id: string
  tenant_id: string
  owner_id: string
  check_in_date: string
  check_out_date: string
  num_nights: number
  num_guests: number
  subtotal_nights: number
  cleaning_fee: number
  daily_cleaning_total: number
  total_amount: number
  platform_fee_percent: number
  payment_method: StrPaymentMethod
  applied_cancellation_policy: StrCancellationPolicy
  status: StrReservationStatus
  has_pet: boolean
  cancelled_by: StrCancelledBy | null
  cancellation_reason: string | null
  cancelled_at: string | null
  checked_in_at: string | null
  checked_out_at: string | null
  guest_notes: string | null
  created_at: string
  updated_at: string
}

export interface StrPricingRow {
  id: string
  property_id: string
  base_price: number
  cleaning_fee: number
  cleaning_fee_per_night: number
  min_nights: number
  max_nights: number
  advance_booking_days: number
  max_guests: number
  cancellation_policy: StrCancellationPolicy
  checkin_config: StrCheckinConfig
  created_at: string
  updated_at: string
}

export interface StrAvailabilityRow {
  id: string
  property_id: string
  date: string
  status: StrAvailabilityStatus
  reservation_id: string | null
  created_at: string
  updated_at: string
}

export interface StrPriceCalendarRow {
  id: string
  property_id: string
  date: string
  price: number
  created_at: string
  updated_at: string
}

export interface StrReservationPaymentRow {
  id: string
  reservation_id: string
  amount: number
  payment_method: StrPaymentMethod
  status: StrPaymentStatus
  external_payment_id: string | null
  gateway_payload: Json | null
  pix_expires_at: string | null
  boleto_due_date: string | null
  boleto_url: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export type MaintenanceStatus =
  | 'aberta'
  | 'em_analise'
  | 'aguardando_aprovacao'
  | 'orcamento_enviado'
  | 'aprovado'
  | 'em_execucao'
  | 'servico_concluido'
  | 'aguardando_validacao'
  | 'finalizado'
  | 'concluida'
  | 'cancelada'

export type MaintenanceCategory =
  | 'hidraulica'
  | 'eletrica'
  | 'estrutural'
  | 'pintura'
  | 'esquadrias'
  | 'portas_fechaduras'
  | 'ar_condicionado'
  | 'outro'

export type MaintenancePriority = 'baixa' | 'normal' | 'alta' | 'urgente'
export type MaintenanceReporterRole = 'owner' | 'tenant' | 'admin'
export type MaintenanceResponsibleParty = 'owner' | 'tenant' | 'condo' | 'technical_inspection'
export type MaintenanceMediaStage = 'before' | 'after' | 'quote_doc' | 'nf'
export type MaintenanceQuoteStatus = 'pendente' | 'aprovado' | 'rejeitado'

export interface MaintenanceRequestRow {
  id: string
  property_id: string
  contract_id: string | null
  reporter_id: string
  reporter_role: MaintenanceReporterRole
  title: string
  description: string
  category: MaintenanceCategory
  priority: MaintenancePriority
  status: MaintenanceStatus
  scheduled_date: string | null
  resolved_at: string | null
  resolution_note: string | null
  problem_start_date: string | null
  is_urgent: boolean
  responsible_party: MaintenanceResponsibleParty | null
  legal_basis: string | null
  triage_answers: Json | null
  approval_deadline_at: string | null
  service_rating: number | null
  service_rating_note: string | null
  validated_at: string | null
  payment_responsible: string | null
  created_at: string
  updated_at: string
}

export interface MaintenanceMediaRow {
  id: string
  request_id: string | null
  draft_id: string | null
  uploader_id: string
  stage: MaintenanceMediaStage
  storage_path: string
  mime_type: string
  file_size_bytes: number | null
  created_at: string
}

export interface MaintenanceEventRow {
  id: string
  request_id: string
  from_status: string | null
  to_status: string
  actor_id: string | null
  notes: string | null
  created_at: string
}

export interface MaintenanceQuoteRow {
  id: string
  request_id: string
  submitted_by: string
  amount: number
  description: string
  status: MaintenanceQuoteStatus
  nf_url: string | null
  submitted_at: string
  responded_at: string | null
  response_note: string | null
}

export interface MaintenanceTriageRuleRow {
  id: string
  category: MaintenanceCategory
  question_key: string
  question_text: string
  display_order: number
  /** 'owner' | 'tenant' | 'condo' | 'technical_inspection' ou `next:<question_key>` */
  answer_yes_leads: string
  answer_no_leads: string
  legal_basis_yes: string | null
  legal_basis_no: string | null
  active: boolean
  created_at: string
}

export interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  data: Json | null
  read_at: string | null
  created_at: string
}

export interface PushTokenRow {
  id: string
  user_id: string
  token: string
  platform: 'ios' | 'android'
  created_at: string
}
