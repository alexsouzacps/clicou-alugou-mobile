import type {
  ProfileRow,
  PropertyRow,
  PropertyMediaRow,
  RentalInterestRow,
  ContractRow,
  StrReservationRow,
  MaintenanceRequestRow,
  NotificationRow,
} from './database';

export interface PropertyCardItem extends PropertyRow {
  cover_image_url: string;
  property_media: Pick<PropertyMediaRow, 'url' | 'is_cover'>[];
  is_favorite?: boolean;
}

export interface ContractWithProperty extends ContractRow {
  property: Pick<PropertyRow, 'id' | 'title' | 'address_street' | 'address_number' | 'address_city' | 'rent_amount'> | null;
  owner: Pick<ProfileRow, 'full_name' | 'phone' | 'email'> | null;
  tenant: Pick<ProfileRow, 'full_name' | 'phone' | 'email'> | null;
}

export interface ReservationWithProperty extends StrReservationRow {
  property: Pick<PropertyRow, 'id' | 'title' | 'address_city' | 'address_neighborhood'> | null;
  owner: Pick<ProfileRow, 'full_name' | 'phone'> | null;
  tenant: Pick<ProfileRow, 'full_name' | 'phone'> | null;
}

export interface ProposalWithDetails extends RentalInterestRow {
  property: Pick<PropertyRow, 'id' | 'title' | 'rent_amount' | 'address_city'> | null;
  tenant: Pick<ProfileRow, 'full_name' | 'email' | 'phone' | 'cpf_cnpj' | 'avatar_url'> | null;
}

export interface ChatParticipant {
  full_name: string;
  avatar_url: string | null;
}

export interface ChatMessageItem {
  id: string;
  room_id: string;
  sender_id: string;
  body: string;
  sent_at: string;
  read_at: string | null;
  sender?: ChatParticipant;
}

export type { ProfileRow, PropertyRow, PropertyMediaRow, RentalInterestRow, ContractRow, StrReservationRow, MaintenanceRequestRow, NotificationRow };
