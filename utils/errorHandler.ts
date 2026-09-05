export function handleSupabaseError(error: any): string {
  if (!error) return 'Ocorreu um erro inesperado. Tente novamente.';

  const message = typeof error === 'string' ? error : error.message || '';

  const errorMap: Record<string, string> = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'Email not confirmed': 'Por favor, confirme seu e-mail antes de entrar.',
    'User already registered': 'Este e-mail já está cadastrado no sistema.',
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
    'JWT expired': 'Sua sessão expirou. Faça login novamente.',
    'Network request failed': 'Sem conexão com a internet. Verifique sua rede.',
    'Failed to fetch': 'Falha na conexão com o servidor. Tente novamente.',
    'PGRST303': 'Sessão expirada. Por favor, faça login novamente.',
  };

  for (const [key, translated] of Object.entries(errorMap)) {
    if (message.includes(key)) {
      return translated;
    }
  }

  return message || 'Ocorreu um erro no servidor. Tente novamente mais tarde.';
}
