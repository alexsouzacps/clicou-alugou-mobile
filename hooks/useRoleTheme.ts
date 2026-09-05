import { colors } from '@/constants/colors';
import { ProfileRole } from '@/types/database';

export function useRoleTheme(role?: ProfileRole | null) {
  const isOwner = role === 'proprietario';

  return {
    isOwner,
    roleLabel: isOwner ? 'Proprietário' : 'Locatário',
    stripeColor: isOwner ? colors.success : colors.cyan,
    accentColor: isOwner ? colors.success : colors.cyan,
    cardBg: isOwner ? colors.bg.owner : colors.bg.tenant,
    badgeVariant: isOwner ? ('owner' as const) : ('tenant' as const),
    badgeIcon: isOwner ? 'home-city' : 'key',
  };
}
