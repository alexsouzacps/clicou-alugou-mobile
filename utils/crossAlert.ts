import { Alert, Platform } from 'react-native';

interface AlertAction {
  text: string;
  onPress?: () => void;
}

/**
 * `Alert.alert()` do react-native é um no-op silencioso no react-native-web —
 * nada aparece na tela, o que faz erros/sucessos "sumirem" ao testar no navegador.
 * Este helper cai pra `window.alert`/`window.confirm` na web, mantendo a mesma
 * assinatura de `Alert.alert` pro resto do app poder trocar sem reescrever a lógica.
 */
export function showAlert(title: string, message?: string, actions?: AlertAction[]) {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    if (actions && actions.length > 1) {
      const confirmed = window.confirm(`${text}\n\n(OK = ${actions[actions.length - 1].text})`);
      const action = confirmed ? actions[actions.length - 1] : actions[0];
      action.onPress?.();
    } else {
      window.alert(text);
      actions?.[0]?.onPress?.();
    }
    return;
  }

  Alert.alert(title, message, actions);
}
