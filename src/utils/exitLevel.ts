import { Platform, Alert } from 'react-native';
import { router } from 'expo-router';

/**
 * Navega FUERA del nivel de forma segura.
 * - Si hay pantalla anterior en el historial, vuelve a ella (mapa/mundo).
 * - Si NO hay historial (entrada directa por URL o salto en modo desarrollador),
 *   navega al mapa de mundos en vez de quedarse atrapado en el nivel.
 */
function navigateOut() {
  try {
    if (router.canGoBack()) {
      router.back();
      return;
    }
  } catch {
    // Si canGoBack/back fallan, usamos el fallback de abajo.
  }
  router.replace('/map');
}

/**
 * Salida robusta y compatible con web de cualquier nivel/evaluación.
 *
 * En web usa `window.confirm` porque `Alert.alert` de react-native-web NO dispara
 * los botones (la razón por la que la X no funcionaba). En nativo usa `Alert.alert`.
 *
 * @param opts.confirm  Si es `false`, sale sin preguntar (p. ej. al completar el nivel).
 * @param opts.message  Texto del diálogo de confirmación.
 */
export function exitLevel(opts?: { confirm?: boolean; message?: string }) {
  const withConfirm = opts?.confirm !== false;
  const message = opts?.message ?? '¿Salir del nivel? Perderás el progreso no guardado.';

  if (!withConfirm) {
    navigateOut();
    return;
  }

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || window.confirm(message)) {
      navigateOut();
    }
    return;
  }

  Alert.alert('Salir', message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Salir', style: 'destructive', onPress: navigateOut },
  ]);
}
