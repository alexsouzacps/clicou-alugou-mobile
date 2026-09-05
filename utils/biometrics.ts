import * as LocalAuthentication from 'expo-local-authentication';
import { setSecureItem, getSecureItem } from './storage';

const BIOMETRICS_KEY = 'clicou_biometrics_enabled';

export async function isBiometricsAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
  await setSecureItem(BIOMETRICS_KEY, enabled ? 'true' : 'false');
}

export async function isBiometricsEnabled(): Promise<boolean> {
  const value = await getSecureItem(BIOMETRICS_KEY);
  return value === 'true';
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  try {
    const available = await isBiometricsAvailable();
    if (!available) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirme sua identidade no Clicou Alugou',
      fallbackLabel: 'Usar senha',
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });

    return result.success;
  } catch (error) {
    console.warn('[biometrics] Erro de autenticação biométrica:', error);
    return false;
  }
}
