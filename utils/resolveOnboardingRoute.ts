/**
 * Fonte única de verdade para o guard de navegação do funil de onboarding.
 * Recebe o estado atual (auth + onboarding) e os segments da rota corrente
 * do expo-router, e devolve para onde redirecionar — ou `null` se a rota
 * atual já é a correta e nada deve mudar.
 */

export type OnboardingRouteState = {
  isAuthenticated: boolean;
  isGuest: boolean;
  hasSeenPermissions: boolean;
  hasSeenTour: boolean;
  /** primeiro segmento da rota atual, ex: '(auth)' | '(tabs)' | 'imovel' */
  segment: string | undefined;
};

/** Rotas fora de (auth)/(tabs) que exigem conta autenticada de verdade (não convidado). */
const AUTH_ONLY_SEGMENTS = ['proposta', 'contrato', 'reserva', 'manutencao', 'chat'];

export function resolveOnboardingRoute(state: OnboardingRouteState): string | null {
  const { isAuthenticated, isGuest, hasSeenPermissions, hasSeenTour, segment } = state;

  const hasAccess = isAuthenticated || isGuest;
  const inAuthGroup = segment === '(auth)';

  // Ainda não viu a tela de permissões: manda para lá, de qualquer rota.
  if (!hasSeenPermissions) {
    return '/(auth)/permissions';
  }

  // Já autenticado (ou convidado) mas ainda dentro do grupo de auth: segue pro app.
  if (hasAccess && inAuthGroup) {
    return '/(tabs)';
  }

  // Sem conta e sem modo convidado, tentando abrir qualquer rota fora de (auth): volta pro funil.
  if (!hasAccess && !inAuthGroup) {
    return '/(auth)/welcome';
  }

  // Convidado tentando abrir rota sensível (dinheiro/documentos): exige login de verdade.
  if (isGuest && !isAuthenticated && segment && AUTH_ONLY_SEGMENTS.includes(segment)) {
    return '/(auth)/login';
  }

  // Tour do Passo 3 pendente e o usuário já tem acesso: deixa a própria home disparar o tour,
  // não força redirect aqui (evita loop com telas de detalhe abertas via deep link).
  void hasSeenTour;

  return null;
}
