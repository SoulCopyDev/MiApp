import { World } from '../store/gameStore';

// ---------- Tipos ----------

export interface LevelTrophy {
  type: 'level';
  worldId: number;
  levelId: number;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  stars: number;
}

export interface WorldTrophy {
  type: 'world';
  worldId: number;
  name: string;
  description: string;
  unlocked: boolean;
  completedLevels: number;
  totalLevels: number;
}

export interface WorldTrophyGroup {
  worldId: number;
  worldName: string;
  worldIcon: string;
  levelTrophies: LevelTrophy[];
  worldTrophy: WorldTrophy;
  completedLevels: number;
  totalLevels: number;
}

export interface TrophyColorScheme {
  accent: string;
  bg: string;
  light: string;
}

// Un esquema de color por mundo. Añadir entradas al ampliar mundos.
export const WORLD_COLORS: Record<number, TrophyColorScheme> = {
  1: { accent: '#005ca8', bg: '#eef3ff', light: '#57a3ff' },
  2: { accent: '#8126cf', bg: '#f3e8ff', light: '#a855f7' },
  3: { accent: '#b07d00', bg: '#fff7e0', light: '#fed01b' },
  4: { accent: '#16a34a', bg: '#dcfce7', light: '#4ade80' },
  5: { accent: '#f97316', bg: '#fff4ed', light: '#fb923c' },
  6: { accent: '#dc2626', bg: '#fff1f2', light: '#f87171' },
};

const FALLBACK_COLOR: TrophyColorScheme = { accent: '#747779', bg: '#f5f7f9', light: '#aaaaaa' };

export function getWorldColor(worldId: number): TrophyColorScheme {
  return WORLD_COLORS[worldId] ?? FALLBACK_COLOR;
}

// ---------- Construcción de grupos ----------

export function buildTrophyGroups(worlds: World[]): WorldTrophyGroup[] {
  return worlds.map(world => {
    const completedLevels = world.levels.filter(l => l.status === 'completed').length;
    const totalLevels = world.levels.length;

    const levelTrophies: LevelTrophy[] = world.levels.map(level => ({
      type: 'level' as const,
      worldId: world.id,
      levelId: level.id,
      name: level.name,
      description: `Nivel ${level.id} · Mundo ${world.id}: ${world.name}`,
      icon: level.icon,
      unlocked: level.status === 'completed',
      stars: level.stars,
    }));

    const worldTrophy: WorldTrophy = {
      type: 'world' as const,
      worldId: world.id,
      name: `Maestro — ${world.name}`,
      description: `¡Completaste los ${totalLevels} niveles de este mundo!`,
      unlocked: completedLevels === totalLevels && totalLevels > 0,
      completedLevels,
      totalLevels,
    };

    return { worldId: world.id, worldName: world.name, worldIcon: world.icon, levelTrophies, worldTrophy, completedLevels, totalLevels };
  });
}

// Cuenta trofeos totales y desbloqueados en todos los grupos.
// Cada mundo aporta: N trofeos de nivel + 1 trofeo de mundo.
export function countTrophies(groups: WorldTrophyGroup[]): { unlocked: number; total: number } {
  let unlocked = 0;
  let total = 0;
  for (const g of groups) {
    total += g.totalLevels + 1;
    unlocked += g.completedLevels + (g.worldTrophy.unlocked ? 1 : 0);
  }
  return { unlocked, total };
}
