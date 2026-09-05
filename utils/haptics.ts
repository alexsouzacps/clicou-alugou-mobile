import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export async function safeImpactAsync(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== 'web') {
    try {
      await Haptics.impactAsync(style);
    } catch (e) {
      // Ignora exceções em plataformas/dispositivos sem suporte a haptics
    }
  }
}

export async function safeNotificationAsync(type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) {
  if (Platform.OS !== 'web') {
    try {
      await Haptics.notificationAsync(type);
    } catch (e) {
      // Ignora exceções em plataformas/dispositivos sem suporte a haptics
    }
  }
}
