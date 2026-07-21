import React from 'react';
import { View, StyleSheet } from 'react-native';

// Indicador de pasos (fila de puntos) — equivalente al `.step-dots` del HTML prototipo.
// Un punto por paso: activo = alargado y con acento, completados = acento tenue, pendientes = gris.
// El estilo/acento se controla SOLO aquí → cambio global para todos los niveles.
type Props = { current: number; total: number; accent?: string };

export default function StepDots({ current, total, accent = '#4f46e5' }: Props) {
  if (!total || total < 2) return null;
  return (
    <View style={styles.row} pointerEvents="none">
      {Array.from({ length: total }).map((_, i) => {
        const isActive = i === current;
        const isDone = i < current;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              isDone && { backgroundColor: accent, opacity: 0.4 },
              isActive && { backgroundColor: accent, width: 18 },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: '#fafafa',
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#d1d5db' },
});
