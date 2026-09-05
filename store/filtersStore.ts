import { create } from 'zustand';
import { PropertyType, RentalType } from '@/types/database';

interface FiltersState {
  rentalType: RentalType;
  city: string;
  propertyType: PropertyType | 'todos';
  minPrice: number | null;
  maxPrice: number | null;
  bedrooms: number | null;
  guests: number | null;
  pets: boolean;
  searchQuery: string;

  setRentalType: (rentalType: RentalType) => void;
  setCity: (city: string) => void;
  setPropertyType: (type: PropertyType | 'todos') => void;
  setPriceRange: (min: number | null, max: number | null) => void;
  setBedrooms: (bedrooms: number | null) => void;
  setGuests: (guests: number | null) => void;
  setPets: (pets: boolean) => void;
  setSearchQuery: (query: string) => void;
  reset: () => void;
}

const initialFilters = {
  rentalType: 'longa_duracao' as RentalType,
  city: '',
  propertyType: 'todos' as const,
  minPrice: null,
  maxPrice: null,
  bedrooms: null,
  guests: null,
  pets: false,
  searchQuery: '',
};

export const useFiltersStore = create<FiltersState>((set) => ({
  ...initialFilters,

  setRentalType: (rentalType) => set({ rentalType }),
  setCity: (city) => set({ city }),
  setPropertyType: (propertyType) => set({ propertyType }),
  setPriceRange: (minPrice, maxPrice) => set({ minPrice, maxPrice }),
  setBedrooms: (bedrooms) => set({ bedrooms }),
  setGuests: (guests) => set({ guests }),
  setPets: (pets) => set({ pets }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  reset: () => set(initialFilters),
}));
