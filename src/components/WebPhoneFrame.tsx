import { type ReactNode } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';

/**
 * Marco tipo "tarjeta/teléfono" para niveles y evaluaciones en web desktop.
 * Replica el layout de los HTML prototipo (@media ≥900px):
 *   .main-area { align/justify center; padding: 28px 24px }
 *   .phone     { max-width: 680px (720px @≥1200px) }
 *   .screen    { border-radius: 20px; box-shadow: 0 8px 48px rgba(0,0,0,.14);
 *                max-height: calc(100vh - 56px) }
 * Así el botón principal queda al fondo de la TARJETA (más arriba en pantalla),
 * no pegado al fondo del viewport.
 */
export default function WebPhoneFrame({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const maxHeight = Math.min(860, height - 56);
  const maxWidth = width >= 1200 ? 720 : 680;
  return (
    <View style={styles.area}>
      <View style={[styles.card, { maxHeight, maxWidth }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  area: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 28, paddingHorizontal: 24 },
  card: {
    flex: 1,
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 48,
    elevation: 12,
  },
});
