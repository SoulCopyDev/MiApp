// Sistema de rangos basado en el total de estrellas acumuladas.
// Agregar un nuevo rango al final del array es suficiente para escalar el sistema.

export interface RankTier {
  level: number;
  name: string;
  icon: string;
  minStars: number;
  maxStars: number;
  color: string;
  bgColor: string;
}

export interface RankInfo {
  tier: RankTier;
  nextTierName: string | null;
  /** Progreso dentro del rango actual, de 0 a 1. */
  progress: number;
  /** Estrellas acumuladas por encima del mínimo del rango. */
  starsInTier: number;
  /** Estrellas que faltan para el siguiente rango (0 si es el máximo). */
  starsNeeded: number;
  isMax: boolean;
}

// Máximo teórico alcanzable: 42 niveles × 3 estrellas = 126 estrellas.
// Los umbrales están distribuidos para que cada rango represente un hito real.
export const RANK_TIERS: readonly RankTier[] = [
  { level: 1, name: 'Novato',     icon: 'school',            minStars: 0,   maxStars: 4,   color: '#747779', bgColor: '#f0f2f3' },
  { level: 2, name: 'Aprendiz',   icon: 'menu-book',         minStars: 5,   maxStars: 14,  color: '#16a34a', bgColor: '#dcfce7' },
  { level: 3, name: 'Explorador', icon: 'explore',           minStars: 15,  maxStars: 29,  color: '#005ca8', bgColor: '#eef3ff' },
  { level: 4, name: 'Analista',   icon: 'analytics',         minStars: 30,  maxStars: 49,  color: '#0284c7', bgColor: '#e0f2fe' },
  { level: 5, name: 'Estratega',  icon: 'psychology',        minStars: 50,  maxStars: 74,  color: '#8126cf', bgColor: '#f3e8ff' },
  { level: 6, name: 'Experto IA', icon: 'military-tech',     minStars: 75,  maxStars: 99,  color: '#4c1d95', bgColor: '#ede9fe' },
  { level: 7, name: 'Maestro',    icon: 'workspace-premium', minStars: 100, maxStars: 119, color: '#b07d00', bgColor: '#fff7e0' },
  { level: 8, name: 'Leyenda IA', icon: 'emoji-events',      minStars: 120, maxStars: 9999, color: '#dc2626', bgColor: '#fff1f2' },
] as const;

/**
 * Calcula el rango actual, el progreso dentro del rango y las estrellas
 * necesarias para el siguiente, a partir del total de estrellas acumuladas.
 *
 * El resultado es determinista y se recalcula automáticamente si totalStars
 * sube o baja (p. ej. tras un resetProgress).
 */
export function getRankInfo(totalStars: number): RankInfo {
  // Encontrar el rango más alto cuyo mínimo el jugador supera
  let tierIndex = 0;
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (totalStars >= RANK_TIERS[i].minStars) tierIndex = i;
    else break;
  }

  const tier = RANK_TIERS[tierIndex];
  const nextTier = RANK_TIERS[tierIndex + 1] as RankTier | undefined;
  const isMax = !nextTier;

  if (isMax) {
    return {
      tier,
      nextTierName: null,
      progress: 1,
      starsInTier: totalStars - tier.minStars,
      starsNeeded: 0,
      isMax: true,
    };
  }

  const range = tier.maxStars - tier.minStars + 1;
  const starsInTier = totalStars - tier.minStars;

  return {
    tier,
    nextTierName: nextTier.name,
    progress: Math.min(starsInTier / range, 1),
    starsInTier,
    starsNeeded: tier.maxStars + 1 - totalStars,
    isMax: false,
  };
}
