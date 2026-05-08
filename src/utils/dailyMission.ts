// Sistema de misiones diarias.
// No importa nada del store (evita dependencia circular). Usa tipado estructural.

export type MissionStatus = 'pending' | 'in_progress' | 'completed';

export interface MissionReward {
  xp: number;
  label: string;
}

export interface DailyMission {
  date: string;           // 'YYYY-MM-DD' fecha local del dispositivo
  startingIndex: number;  // índice plano en el momento de generar la misión
  targetWorldId: number;
  targetLevelId: number;
  targetLevelName: string;
  targetWorldName: string;
  reward: MissionReward;
  status: MissionStatus;
  rewardClaimed: boolean;
}

// ---------- Tipos estructurales mínimos ----------

type LevelStatus = 'locked' | 'current' | 'completed';

interface LevelLike {
  id: number;
  name: string;
  status: LevelStatus;
}

interface WorldLike {
  id: number;
  name: string;
  levels: LevelLike[];
}

interface FlatLevel {
  index: number;
  worldId: number;
  levelId: number;
  worldName: string;
  levelName: string;
  status: LevelStatus;
}

// ---------- Helpers privados ----------

function buildFlatLevels(worlds: WorldLike[]): FlatLevel[] {
  const flat: FlatLevel[] = [];
  for (const w of worlds) {
    for (const l of w.levels) {
      flat.push({
        index: flat.length,
        worldId: w.id,
        levelId: l.id,
        worldName: w.name,
        levelName: l.name,
        status: l.status,
      });
    }
  }
  return flat;
}

function findCurrentIndex(flat: FlatLevel[]): number {
  const idx = flat.findIndex(l => l.status === 'current');
  if (idx !== -1) return idx;

  // No hay 'current': buscar último 'completed' + 1
  for (let i = flat.length - 1; i >= 0; i--) {
    if (flat[i].status === 'completed') return Math.min(i + 1, flat.length - 1);
  }
  return 0;
}

// ---------- API pública ----------

/**
 * Genera una misión nueva para la fecha indicada.
 * El objetivo es un nivel entre 2 y 5 posiciones por delante del nivel
 * actual del jugador, nunca fuera del rango de niveles disponibles.
 */
export function generateDailyMission(worlds: WorldLike[], date: string): DailyMission {
  const flat = buildFlatLevels(worlds);
  const currentIndex = findCurrentIndex(flat);

  // Offset aleatorio 2–5; el resultado se persiste, así que Math.random es válido aquí
  const offset = 2 + Math.floor(Math.random() * 4);
  const targetIndex = Math.min(currentIndex + offset, flat.length - 1);
  const target = flat[targetIndex];

  // Recompensa escala con el esfuerzo requerido
  const xp = 50 + offset * 25; // 100 | 125 | 150 | 175

  return {
    date,
    startingIndex: currentIndex,
    targetWorldId: target.worldId,
    targetLevelId: target.levelId,
    targetLevelName: target.levelName,
    targetWorldName: target.worldName,
    reward: { xp, label: `+${xp} XP` },
    status: 'pending',
    rewardClaimed: false,
  };
}

/**
 * Calcula el progreso de la misión (0–1) basándose en cuántos niveles
 * dentro del rango [startingIndex, targetIndex] están completados.
 */
export function getMissionProgress(mission: DailyMission, worlds: WorldLike[]): number {
  const flat = buildFlatLevels(worlds);
  const targetIdx = flat.findIndex(
    l => l.worldId === mission.targetWorldId && l.levelId === mission.targetLevelId
  );
  if (targetIdx === -1 || targetIdx <= mission.startingIndex) return 0;

  const range = flat.slice(mission.startingIndex, targetIdx + 1);
  const completed = range.filter(l => l.status === 'completed').length;
  return Math.min(completed / range.length, 1);
}

/**
 * Determina el estado actual de la misión leyendo el progreso del jugador.
 * No modifica nada; solo observa.
 */
export function detectMissionStatus(mission: DailyMission, worlds: WorldLike[]): MissionStatus {
  // Comprobar si el nivel objetivo está completado
  const level = worlds.find(w => w.id === mission.targetWorldId)
    ?.levels.find(l => l.id === mission.targetLevelId);
  if (level?.status === 'completed') return 'completed';

  // Comprobar si el jugador ha avanzado desde el punto de inicio
  const flat = buildFlatLevels(worlds);
  if (findCurrentIndex(flat) > mission.startingIndex) return 'in_progress';

  return 'pending';
}
